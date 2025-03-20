import { Button, IconButton, Typography, Snackbar, Alert, CircularProgress, Fade, Tooltip, Drawer, MenuItem, Select, InputLabel, FormControl, Menu, Backdrop, Stepper, Step, StepLabel } from "@mui/material";
import { MuiColorInput } from "mui-color-input";
import { PlayArrow, Settings, Movie, Pause, Replay } from "@mui/icons-material";
import Slider from "./Slider";
import { useState, useEffect, useRef, useImperativeHandle, forwardRef, useMemo } from "react";
import { INITIAL_COLORS, LOCATIONS } from "../config";
import { arrayToRgb, rgbToArray } from "../helpers";
import countryList from "react-select-country-list";
// import   {
//     setDefaults,
//     fromAddress } from "react-geocode";
import Geocode from "react-geocode";

// Set Google API key
// setKey("AIzaSyBFKGbLYqSzHy2SzMT-4PTrAcSrVcc0ZxY");
// setLanguage("en");

Geocode.setApiKey("AIzaSyBFKGbLYqSzHy2SzMT-4PTrAcSrVcc0ZxY");
Geocode.setLanguage("en");
Geocode.setRegion("es");

// setDefaults({ key: "AIzaSyBFKGbLYqSzHy2SzMT-4PTrAcSrVcc0ZxY", // Your API key here.
//     language: "en", // Default language for responses.
//     region: "es", // Default region for responses.
// });

// console.log(Geocode);

const Interface = forwardRef(({ canStart, started, animationEnded, playbackOn, time, maxTime, settings, colors, loading, timeChanged, cinematic, placeEnd, changeRadius, changeAlgorithm, setPlaceEnd, setCinematic, setSettings, setColors, startPathfinding, toggleAnimation, clearPath, changeLocation }, ref) => {
    const [sidebar, setSidebar] = useState(false);
    const [snack, setSnack] = useState({
        open: false,
        message: "",
        type: "error",
    });
    const [showTutorial, setShowTutorial] = useState(false);
    const [activeStep, setActiveStep] = useState(0);
    const [helper, setHelper] = useState(false);
    const [menuAnchor, setMenuAnchor] = useState(null);
    const menuOpen = Boolean(menuAnchor);
    const helperTime = useRef(4800);
    const rightDown = useRef(false);
    const leftDown = useRef(false);
    const listOfAllCountries = useMemo(() => countryList().getData(), []);
    const [updatedCountries, setUpdatedCountries] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const filteredCountries = useMemo(() => {
        return updatedCountries.filter(country => 
            country.label.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [updatedCountries, searchQuery]);

    useEffect(() => {
        const fetchCoordinates = async () => {
        // Fetch all country coordinates in parallel
            const updatedList = await Promise.all(
                listOfAllCountries.map(async (country) => {
                    try {
                        const response = await Geocode.fromAddress(country.label);
                        const { lat, lng } = response.results[0].geometry.location;

                        return {
                            ...country,
                            latitude: lat,
                            longitude: lng // Append lat/lng
                        };
                    } catch (error) {
                        console.error(`Error fetching coordinates for ${country.label}:`, error);
                        return country; // Keep original country if API fails
                    }
                })
            );

            setUpdatedCountries(updatedList);
        };

        fetchCoordinates();
    }, [listOfAllCountries]);

    // Expose showSnack to parent from ref
    useImperativeHandle(ref, () => ({
        showSnack(message, type = "error") {
            setSnack({ open: true, message, type });
        },
    }));
      
    function closeSnack() {
        setSnack({...snack, open: false});
    }

    function closeHelper() {
        setHelper(false);
    }

    function handleTutorialChange(direction) {
        if(activeStep >= 2 && direction > 0) {
            setShowTutorial(false);
            return;
        }
        
        setActiveStep(Math.max(activeStep + direction, 0));
    }

    // Start pathfinding or toggle playback
    function handlePlay() {
        if(!canStart) return;
        if(!started && time === 0) {
            startPathfinding();
            return;
        }
        toggleAnimation();
    }
    
    function closeMenu() {
        setMenuAnchor(null);
    }

    window.onkeydown = e => {
        if(e.code === "ArrowRight" && !rightDown.current && !leftDown.current && (!started || animationEnded)) {
            rightDown.current = true;
            toggleAnimation(false, 1);
        }
        else if(e.code === "ArrowLeft" && !leftDown.current && !rightDown.current && animationEnded) {
            leftDown.current = true;
            toggleAnimation(false, -1);
        }
    };

    window.onkeyup = e => {
        if(e.code === "Escape") setCinematic(false);
        else if(e.code === "Space") {
            e.preventDefault();
            handlePlay();
        }
        else if(e.code === "ArrowRight" && rightDown.current) {
            rightDown.current = false;
            toggleAnimation(false, 1);
        }
        else if(e.code === "ArrowLeft" && animationEnded && leftDown.current) {
            leftDown.current = false;
            toggleAnimation(false, 1);
        }
        else if(e.code === "KeyR" && (animationEnded || !started)) clearPath();
    };

    // Show cinematic mode helper
    useEffect(() => {
        if(!cinematic) return;
        setHelper(true);
        setTimeout(() => {
            helperTime.current = 2500;
        }, 200);
    }, [cinematic]);

    useEffect(() => {
        if(localStorage.getItem("path_sawtutorial")) return;
        setShowTutorial(true);
        localStorage.setItem("path_sawtutorial", true);
    }, []);

    // Add algorithm descriptions
    const algorithmInfo = {
        astar: {
            name: "A* Algorithm",
            description: "A fast pathfinding algorithm that uses heuristics to find the optimal path",
            icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                    <polyline points="2 17 12 22 22 17"></polyline>
                    <polyline points="2 12 12 17 22 12"></polyline>
                </svg>
            )
        },
        greedy: {
            name: "Greedy Algorithm",
            description: "Makes locally optimal choices, may not find the shortest path but is very fast",
            icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
            )
        },
        dijkstra: {
            name: "Dijkstra's Algorithm",
            description: "Guarantees the shortest path by exploring all possible routes",
            icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                    <line x1="9" y1="9" x2="9.01" y2="9"></line>
                    <line x1="15" y1="9" x2="15.01" y2="9"></line>
                </svg>
            )
        },
        bidirectional: {
            name: "Bidirectional Search",
            description: "Searches from both start and end points simultaneously for faster results",
            icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 1l4 4-4 4"></path>
                    <path d="M7 23l-4-4 4-4"></path>
                    <path d="M21 5H3"></path>
                    <path d="M21 19H3"></path>
                </svg>
            )
        },
        bidirectional1: {
            name: "Bidirectional Search",
            description: "Searches from both start and end points simultaneously for faster results",
            icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 1l4 4-4 4"></path>
                    <path d="M7 23l-4-4 4-4"></path>
                    <path d="M21 5H3"></path>
                    <path d="M21 19H3"></path>
                </svg>
            )
        },
        bidirectional2: {
            name: "Bidirectional Search",
            description: "Searches from both start and end points simultaneously for faster results",
            icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 1l4 4-4 4"></path>
                    <path d="M7 23l-4-4 4-4"></path>
                    <path d="M21 5H3"></path>
                    <path d="M21 19H3"></path>
                </svg>
            )
        }
    };

    // Add algorithm categories
    const algorithmCategories = {
        popular: {
            title: "Popular",
            algorithms: ["astar", "dijkstra"]
        },
        experimental: {
            title: "Experimental",
            algorithms: ["greedy", "bidirectional"]
        }
    };

    return (
        <>
            <div className={`nav-top ${cinematic ? "cinematic" : ""}`}>
                <div className="nav-container" style={{
                    width: "70%",
                    position: "fixed",
                    top: "20px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    zIndex: 1000,
                    backgroundColor: "transparent",
                    padding: "8px 20px 8px 20px",
                    borderRadius: "50px",
                    boxShadow: "0 2px 15px rgba(0, 0, 0, 0.08)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "8px",
                    backdropFilter: "blur(10px)",
                    WebkitBackdropFilter: "blur(10px)"
                }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px"}}>
                        <Tooltip title="Open settings">
                            <IconButton onClick={() => {setSidebar(true);}} style={{ backgroundColor: "transparent", width: 36, height: 36 }} size="large">
                                <Settings style={{ color: "#fff", width: 24, height: 24 }} fontSize="inherit" />
                            </IconButton>
                        </Tooltip>

                        <Tooltip title="Cinematic mode">
                            <IconButton className="btn-cinematic" onClick={() => {setCinematic(!cinematic);}} style={{ backgroundColor: "transparent", width: 36, height: 36 }} size="large">
                                <Movie style={{ color: "#fff", width: 24, height: 24 }} fontSize="inherit" />
                            </IconButton>
                        </Tooltip>
                    </div>

                    <div
                        className="side slider-container"
                        style={{
                            margin: "5px 10px 5px 10px",
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center"
                        }}
                    >
                        <Typography id="playback-slider" gutterBottom>
                            Animation playback
                        </Typography>
                        <Slider style={{ height: "0px"}} disabled={!animationEnded}  value={animationEnded ? time : maxTime} min={animationEnded ? 0 : -1} max={maxTime} onChange={(e) => {timeChanged(Number(e.target.value));}} className="slider" aria-labelledby="playback-slider" />
                    </div>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px"}}>
                        <IconButton disabled={!canStart} onClick={handlePlay} style={{ backgroundColor: "transparent", width: 60, height: 60, border: !canStart ? "none" : "1px solid #46B780" }} size="large">
                            {(!started || animationEnded && !playbackOn)
                                ? <PlayArrow style={{ color: "#46B780", width: 26, height: 26 }} fontSize="inherit" />
                                : <Pause style={{ color: "#fff", width: 26, height: 26 }} fontSize="inherit" />
                            }
                        </IconButton>

                        <div className="side" style={{ width: "fit-content" }}>
                            <Button
                                disabled={!animationEnded && started}
                                onClick={clearPath} 
                                style={{ color: (!animationEnded && started) ? "#fff" : "red", backgroundColor: "transparent", boxShadow: "none", border: (!animationEnded && started) ? "none" : "1px solid red" }} variant="contained"
                            >
                                Clear path
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* <div className={`nav-right ${cinematic ? "cinematic" : ""}`}>
                <Tooltip title="Open settings">
                    <IconButton onClick={() => {setSidebar(true);}} style={{ backgroundColor: "#2A2B37", width: 36, height: 36 }} size="large">
                        <Settings style={{ color: "#fff", width: 24, height: 24 }} fontSize="inherit" />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Cinematic mode">
                    <IconButton className="btn-cinematic" onClick={() => {setCinematic(!cinematic);}} style={{ backgroundColor: "#2A2B37", width: 36, height: 36 }} size="large">
                        <Movie style={{ color: "#fff", width: 24, height: 24 }} fontSize="inherit" />
                    </IconButton>
                </Tooltip>
            </div> */}

            <div className="loader-container">
                <Fade
                    in={loading}
                    style={{
                        transitionDelay: loading ? "50ms" : "0ms",
                    }}
                    unmountOnExit
                >
                    <CircularProgress color="inherit" />
                </Fade>
            </div>

            <Snackbar 
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }} 
                open={snack.open} 
                autoHideDuration={4000} 
                onClose={closeSnack}>
                <Alert 
                    onClose={closeSnack} 
                    severity={snack.type} 
                    style={{ width: "100%", color: "#fff" }}
                >
                    {snack.message}
                </Alert>
            </Snackbar>

            <Snackbar 
                anchorOrigin={{ vertical: "top", horizontal: "center" }} 
                open={helper} 
                autoHideDuration={helperTime.current} 
                onClose={closeHelper}
            >
                <div className="cinematic-alert">
                    <Typography fontSize="18px"><b>Cinematic mode</b></Typography>
                    <Typography>Use keyboard shortcuts to control animation</Typography>
                    <Typography>Press <b>Escape</b> to exit</Typography>
                </div>
            </Snackbar>

            <div className="mobile-controls">
                <Button onClick={() => {setPlaceEnd(!placeEnd);}} style={{ color: "#fff", backgroundColor: "#404156", paddingInline: 30, paddingBlock: 7 }} variant="contained">
                    {placeEnd ? "placing end node" : "placing start node"}
                </Button>
            </div>

            {/* <Backdrop
                open={showTutorial}
                onClick={e => {if(e.target.classList.contains("backdrop")) setShowTutorial(false);}}
                className="backdrop"
            >
                <div className="tutorial-container">
                    <Stepper activeStep={activeStep}>
                        <Step>
                            <StepLabel>Basic controls</StepLabel>
                        </Step>
                        <Step>
                            <StepLabel>Playback controls</StepLabel>
                        </Step>
                        <Step>
                            <StepLabel>Changing settings</StepLabel>
                        </Step>
                    </Stepper>
                    <div className="content">
                        <h1>Map Pathfinding Visualizer</h1>
                        {activeStep === 0 && <div>
                            <p>
                                <b>Controls:</b> <br/>
                                <b>Left button:</b> Place start node <br/>
                                <b>Right button:</b> Place end node <br/>
                            </p>
                            <p>The end node must be placed within the shown radius.</p>
                            <video className="video" autoPlay muted loop>
                                <source src="./videos/tutorial1.mp4" type="video/mp4"/>
                            </video>
                        </div>}
                        {activeStep === 1 && <div>
                            <p>
                                To start the visualization, press the <b>Start Button</b> or press <b>Space</b>.<br/>
                                A playback feature is available after the algorithm ends.
                            </p>
                            <video className="video" autoPlay muted loop>
                                <source src="./videos/tutorial2.mp4" type="video/mp4"/>
                            </video>
                        </div>}
                        {activeStep === 2 && <div>
                            <p>
                                You can customize the settings of the animation in the <b>Settings Sidebar</b>. <br/>
                                Try to keep the area radius only as large as you need it to be. <br/>
                                Anything above <b>10km</b> is considered experimental, if you run into performance issues, stop the animation and clear the path.
                            </p>
                            <video className="video" autoPlay muted loop>
                                <source src="./videos/tutorial3.mp4" type="video/mp4"/>
                            </video>
                        </div>}
                    </div>
                    <div className="controls">
                        <Button onClick={() => {setShowTutorial(false);}}
                            className="close" variant="outlined" style={{ borderColor: "#9f9f9f", color: "#9f9f9f", paddingInline: 15 }}
                        >
                            Close
                        </Button>
                        <Button onClick={() => {handleTutorialChange(-1);}}
                            variant="outlined" style={{ borderColor: "#9f9f9f", color: "#9f9f9f", paddingInline: 18 }}
                        >
                                Back
                        </Button>
                        <Button onClick={() => {handleTutorialChange(1);}}
                            variant="contained" style={{ backgroundColor: "#46B780", color: "#fff", paddingInline: 30, fontWeight: "bold" }}
                        >
                            {activeStep >= 2 ? "Finish" : "Next"}
                        </Button>
                    </div>
                </div>
            </Backdrop> */}
            
            {/* <Drawer
                className={`side-drawer ${cinematic ? "cinematic" : ""}`}
                anchor="left"
                open={sidebar}
                onClose={() => {setSidebar(false);}}
            > */}

            <Backdrop
                // anchor="left"
                open={sidebar}
                onClose={() => {setSidebar(false);}}
                className={`backdrop ${cinematic ? "cinematic" : ""}`}
            >
                {/* <div className="sidebar-container"> */}
                <div className="tutorial-container">
                    {/* Bottom Controls */}
                    <div style={{ 
                        display: 'flex',
                        justifyContent: 'flex-end',
                        marginBottom: '16px'
                    }}>
                        <Button
                            onClick={() => {setSidebar(false);}}
                            variant="outlined"
                            sx={{
                                borderColor: "rgba(255,255,255,0.2)",
                                color: "rgba(255,255,255,0.7)",
                                textTransform: "none",
                                fontWeight: "500",
                                padding: "8px 24px",
                                borderRadius: "8px",
                                '&:hover': {
                                    borderColor: "rgba(255,255,255,0.3)",
                                    backgroundColor: "rgba(255,255,255,0.05)"
                                }
                            }}
                        >
                            Close
                        </Button>
                    </div>
                    <h1
                        style={{
                            background: "rgba(255, 255, 255, 0.1)",
                            marginTop: 0,
                        }}
                    >Settings</h1>
                    <div style={{display: "grid", gridTemplateColumns: "60% 40%", justifyContent: "space-between", gap: 8}}>

                        {/* List of Algorithms */}
                        <div style={{ width: "100%" }}>
                            <div style={{ 
                                marginBottom: "8px", 
                                color: "#A8AFB3", 
                                fontSize: "14px",
                                fontWeight: "500",
                                textTransform: "uppercase" 
                            }}>
                                Algorithm
                            </div>
                            <div style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "16px",
                                maxHeight: "300px",
                                overflowY: "auto",
                                paddingRight: "12px",
                                marginRight: "-12px", // Compensate for padding to align with other elements
                                scrollbarWidth: "thin",
                                scrollbarColor: "rgba(255,255,255,0.3) transparent",
                                "&::-webkit-scrollbar": {
                                    width: "4px",
                                },
                                "&::-webkit-scrollbar-track": {
                                    background: "transparent",
                                },
                                "&::-webkit-scrollbar-thumb": {
                                    background: "rgba(255,255,255,0.3)",
                                    borderRadius: "4px",
                                }
                            }}>
                                {Object.entries(algorithmCategories).map(([categoryKey, category]) => (
                                    <div key={categoryKey}>
                                        <div style={{
                                            color: "rgba(255,255,255,0.5)",
                                            fontSize: "12px",
                                            fontWeight: "500",
                                            textTransform: "uppercase",
                                            letterSpacing: "0.5px",
                                            marginBottom: "8px",
                                            paddingLeft: "4px"
                                        }}>
                                            {category.title}
                                        </div>
                                        <div style={{
                                            display: "grid",
                                            flexDirection: "column",
                                            gap: "8px"
                                        }}>
                                            {category.algorithms.map(key => {
                                                const algo = algorithmInfo[key];
                                                return (
                                                    <button
                                                        key={key}
                                                        onClick={() => changeAlgorithm(key)}
                                                        disabled={!animationEnded && started}
                                                        style={{
                                                            backgroundColor: "transparent",
                                                            border: "none",
                                                            borderRadius: "12px",
                                                            padding: "12px",
                                                            cursor: "pointer",
                                                            textAlign: "left",
                                                            transition: "all 0.2s ease",
                                                            opacity: (!animationEnded && started) ? 0.5 : 1,
                                                            position: "relative",
                                                            display: "flex",
                                                            alignItems: "center",
                                                            gap: "16px",
                                                            background: settings.algorithm === key ? "linear-gradient(90deg, rgba(70, 183, 128, 0.15) 0%, rgba(70, 183, 128, 0) 100%)" : "transparent",
                                                            '&:hover': {
                                                                background: settings.algorithm === key 
                                                                    ? "linear-gradient(90deg, rgba(70, 183, 128, 0.2) 0%, rgba(70, 183, 128, 0) 100%)" 
                                                                    : "rgba(255, 255, 255, 0.05)"
                                                            }
                                                        }}
                                                    >
                                                        <div style={{
                                                            display: "flex",
                                                            alignItems: "center",
                                                            justifyContent: "center",
                                                            width: "40px",
                                                            height: "40px",
                                                            borderRadius: "10px",
                                                            backgroundColor: settings.algorithm === key ? "rgba(70, 183, 128, 0.15)" : "rgba(255,255,255,0.1)",
                                                            color: settings.algorithm === key ? "#46B780" : "#fff",
                                                            flexShrink: 0
                                                        }}>
                                                            {algo.icon}
                                                        </div>
                                                        <div style={{
                                                            flex: 1,
                                                            minWidth: 0
                                                        }}>
                                                            <div style={{
                                                                color: settings.algorithm === key ? "#46B780" : "#fff",
                                                                fontSize: "15px",
                                                                fontWeight: "500",
                                                                marginBottom: "4px"
                                                            }}>
                                                                {algo.name}
                                                            </div>
                                                            <div style={{
                                                                color: "rgba(255,255,255,0.5)",
                                                                fontSize: "13px",
                                                                lineHeight: "1.4",
                                                                whiteSpace: "nowrap",
                                                                overflow: "hidden",
                                                                textOverflow: "ellipsis"
                                                            }}>
                                                                {algo.description}
                                                            </div>
                                                        </div>
                                                        {settings.algorithm === key && (
                                                            <div style={{
                                                                width: "6px",
                                                                height: "6px",
                                                                borderRadius: "50%",
                                                                backgroundColor: "#46B780",
                                                                flexShrink: 0
                                                            }} />
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Locations Dropdown */}
                        <div style={{ width: "100%" }}>
                            <Button
                                id="locations-button"
                                aria-controls={menuOpen ? "locations-menu" : undefined}
                                aria-haspopup="true"
                                aria-expanded={menuOpen ? "true" : undefined}
                                onClick={(e) => {setMenuAnchor(e.currentTarget);}}
                                sx={{ 
                                    backgroundColor: "rgba(255,255,255,0.1)", 
                                    color: "#fff", 
                                    textTransform: "none", 
                                    fontSize: "14px", 
                                    padding: "12px 16px",
                                    width: "100%",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    borderRadius: "8px",
                                    transition: "all 0.2s ease",
                                    '&:hover': {
                                        backgroundColor: "rgba(255,255,255,0.15)"
                                    }
                                }}
                            >
                                <span style={{ 
                                    display: "flex", 
                                    alignItems: "center", 
                                    gap: "8px",
                                    fontWeight: "500"
                                }}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.9 }}>
                                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                        <circle cx="12" cy="10" r="3"></circle>
                                    </svg>
                                    Locations
                                </span>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.7 }}>
                                    <polyline points="6 9 12 15 18 9"></polyline>
                                </svg>
                            </Button>
                            <Menu
                                id="locations-menu"
                                anchorEl={menuAnchor}
                                open={menuOpen}
                                onClose={() => {setMenuAnchor(null);}}
                                sx={{
                                    '& .MuiPaper-root': {
                                        backgroundColor: "#2A2B3D",
                                        borderRadius: "12px",
                                        boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                                        marginTop: "8px",
                                        border: "1px solid rgba(255,255,255,0.1)",
                                        minWidth: "300px",
                                        maxWidth: "300px",
                                        padding: "12px",
                                        '& .MuiList-root': {
                                            padding: 0
                                        }
                                    }
                                }}
                                anchorOrigin={{
                                    vertical: "bottom",
                                    horizontal: "left",
                                }}
                                transformOrigin={{
                                    vertical: "top",
                                    horizontal: "left",
                                }}
                            >
                                <div style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                    backgroundColor: "rgba(255,255,255,0.05)",
                                    borderRadius: "8px",
                                    padding: "10px 12px",
                                    margin: "0 0 12px 0"
                                }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "rgba(255,255,255,0.5)" }}>
                                        <circle cx="11" cy="11" r="8"></circle>
                                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                    </svg>
                                    <input
                                        type="text"
                                        placeholder="Search countries..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        style={{
                                            background: "none",
                                            border: "none",
                                            color: "#fff",
                                            width: "100%",
                                            outline: "none",
                                            fontSize: "14px",
                                            '&::placeholder': {
                                                color: "rgba(255,255,255,0.3)"
                                            }
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </div>
                                <div style={{ 
                                    maxHeight: "300px", 
                                    overflowY: "auto",
                                    marginRight: "-8px",
                                    paddingRight: "8px",
                                    scrollbarWidth: "thin",
                                    scrollbarColor: "rgba(255,255,255,0.1) rgba(255,255,255,0.05)",
                                    "&::-webkit-scrollbar": {
                                        width: "6px"
                                    },
                                    "&::-webkit-scrollbar-track": {
                                        background: "rgba(255,255,255,0.05)",
                                        borderRadius: "3px"
                                    },
                                    "&::-webkit-scrollbar-thumb": {
                                        background: "rgba(255,255,255,0.1)",
                                        borderRadius: "3px"
                                    }
                                }}>
                                    {filteredCountries.length === 0 ? (
                                        <div style={{ 
                                            padding: "20px", 
                                            color: "rgba(255,255,255,0.5)",
                                            textAlign: "center",
                                            fontSize: "14px"
                                        }}>
                                            No countries found
                                        </div>
                                    ) : (
                                        filteredCountries.map(location =>
                                            <MenuItem 
                                                key={location.label} 
                                                onClick={() => {
                                                    closeMenu();
                                                    changeLocation(location);
                                                    setSidebar(false);
                                                    setSearchQuery("");
                                                }}
                                                sx={{
                                                    borderRadius: "6px",
                                                    padding: "12px 16px",
                                                    margin: "2px 0",
                                                    fontSize: "14px",
                                                    color: "rgba(255,255,255,0.9)",
                                                    transition: "all 0.2s ease",
                                                    fontWeight: "500",
                                                    "&:hover": {
                                                        backgroundColor: "rgba(255,255,255,0.1)"
                                                    }
                                                }}
                                            >
                                                {location.label}
                                            </MenuItem>
                                        )
                                    )}
                                </div>
                            </Menu>
                        </div>

                    </div>

                    {/* Controls */}
                    <div style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "24px"
                    }}>
                        <div style={{ 
                            color: "#A8AFB3", 
                            fontSize: "14px",
                            fontWeight: "500",
                            textTransform: "uppercase",
                            letterSpacing: "0.5px"
                        }}>
                            Controls
                        </div>

                        <div style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(2, 1fr)",
                            gap: "16px"
                        }}>
                            {/* Area Radius Control */}
                            <div style={{
                                background: "rgba(255,255,255,0.05)",
                                borderRadius: "12px",
                                padding: "16px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "16px"
                            }}>
                                <div style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center"
                                }}>
                                    <span style={{
                                        color: "#fff",
                                        fontSize: "14px",
                                        fontWeight: "500"
                                    }}>
                                        Area Radius
                                    </span>
                                    <span style={{
                                        color: "rgba(255,255,255,0.5)",
                                        fontSize: "13px"
                                    }}>
                                        {settings.radius}km ({(settings.radius / 1.609).toFixed(1)}mi)
                                    </span>
                                </div>
                                <Slider
                                    disabled={started && !animationEnded}
                                    min={2}
                                    max={20}
                                    step={1}
                                    value={settings.radius}
                                    onChangeCommitted={() => { changeRadius(settings.radius); }}
                                    onChange={e => { setSettings({...settings, radius: Number(e.target.value)}); }}
                                    marks={[
                                        { value: 2, label: "2km" },
                                        { value: 20, label: "20km" }
                                    ]}
                                    sx={{
                                        color: '#46B780',
                                        '& .MuiSlider-thumb': {
                                            width: 12,
                                            height: 12,
                                            backgroundColor: '#46B780',
                                            '&:hover, &.Mui-focusVisible': {
                                                boxShadow: '0 0 0 8px rgba(70, 183, 128, 0.16)'
                                            }
                                        },
                                        '& .MuiSlider-track': {
                                            height: 4,
                                            backgroundColor: '#46B780'
                                        },
                                        '& .MuiSlider-rail': {
                                            height: 4,
                                            backgroundColor: 'rgba(255,255,255,0.1)'
                                        },
                                        '& .MuiSlider-mark': {
                                            backgroundColor: 'rgba(255,255,255,0.2)',
                                            height: 8,
                                            width: 1,
                                            marginTop: -2
                                        },
                                        '& .MuiSlider-markLabel': {
                                            color: 'rgba(255,255,255,0.5)',
                                            fontSize: '12px'
                                        }
                                    }}
                                />
                            </div>

                            {/* Animation Speed Control */}
                            <div style={{
                                background: "rgba(255,255,255,0.05)",
                                borderRadius: "12px",
                                padding: "16px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "16px"
                            }}>
                                <div style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center"
                                }}>
                                    <span style={{
                                        color: "#fff",
                                        fontSize: "14px",
                                        fontWeight: "500"
                                    }}>
                                        Animation Speed
                                    </span>
                                    <span style={{
                                        color: "rgba(255,255,255,0.5)",
                                        fontSize: "13px"
                                    }}>
                                        {settings.speed}x
                                    </span>
                                </div>
                                <Slider
                                    min={1}
                                    max={30}
                                    value={settings.speed}
                                    onChange={e => { setSettings({...settings, speed: Number(e.target.value)}); }}
                                    marks={[
                                        { value: 1, label: "1x" },
                                        { value: 30, label: "30x" }
                                    ]}
                                    sx={{
                                        color: '#46B780',
                                        '& .MuiSlider-thumb': {
                                            width: 12,
                                            height: 12,
                                            backgroundColor: '#46B780',
                                            '&:hover, &.Mui-focusVisible': {
                                                boxShadow: '0 0 0 8px rgba(70, 183, 128, 0.16)'
                                            }
                                        },
                                        '& .MuiSlider-track': {
                                            height: 4,
                                            backgroundColor: '#46B780'
                                        },
                                        '& .MuiSlider-rail': {
                                            height: 4,
                                            backgroundColor: 'rgba(255,255,255,0.1)'
                                        },
                                        '& .MuiSlider-mark': {
                                            backgroundColor: 'rgba(255,255,255,0.2)',
                                            height: 8,
                                            width: 1,
                                            marginTop: -2
                                        },
                                        '& .MuiSlider-markLabel': {
                                            color: 'rgba(255,255,255,0.5)',
                                            fontSize: '12px'
                                        }
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Styles */}
                    <div style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "24px"
                    }}>
                        <div style={{ 
                            color: "#A8AFB3", 
                            fontSize: "14px",
                            fontWeight: "500",
                            textTransform: "uppercase",
                            letterSpacing: "0.5px"
                        }}>
                            Styles
                        </div>

                        <div style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(2, 1fr)",
                            gap: "16px"
                        }}>
                            {[
                                {
                                    label: "Start Node Fill",
                                    value: arrayToRgb(colors.startNodeFill),
                                    onChange: v => setColors({...colors, startNodeFill: rgbToArray(v)}),
                                    onReset: () => setColors({...colors, startNodeFill: INITIAL_COLORS.startNodeFill})
                                },
                                {
                                    label: "Start Node Border",
                                    value: arrayToRgb(colors.startNodeBorder),
                                    onChange: v => setColors({...colors, startNodeBorder: rgbToArray(v)}),
                                    onReset: () => setColors({...colors, startNodeBorder: INITIAL_COLORS.startNodeBorder})
                                },
                                {
                                    label: "End Node Fill",
                                    value: arrayToRgb(colors.endNodeFill),
                                    onChange: v => setColors({...colors, endNodeFill: rgbToArray(v)}),
                                    onReset: () => setColors({...colors, endNodeFill: INITIAL_COLORS.endNodeFill})
                                },
                                {
                                    label: "End Node Border",
                                    value: arrayToRgb(colors.endNodeBorder),
                                    onChange: v => setColors({...colors, endNodeBorder: rgbToArray(v)}),
                                    onReset: () => setColors({...colors, endNodeBorder: INITIAL_COLORS.endNodeBorder})
                                },
                                {
                                    label: "Path Color",
                                    value: arrayToRgb(colors.path),
                                    onChange: v => setColors({...colors, path: rgbToArray(v)}),
                                    onReset: () => setColors({...colors, path: INITIAL_COLORS.path})
                                },
                                {
                                    label: "Route Color",
                                    value: arrayToRgb(colors.route),
                                    onChange: v => setColors({...colors, route: rgbToArray(v)}),
                                    onReset: () => setColors({...colors, route: INITIAL_COLORS.route})
                                }
                            ].map((item, index) => (
                                <div key={index} style={{
                                    background: "rgba(255,255,255,0.05)",
                                    borderRadius: "12px",
                                    padding: "16px",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "12px"
                                }}>
                                    <div style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center"
                                    }}>
                                        <span style={{
                                            color: "#fff",
                                            fontSize: "14px",
                                            fontWeight: "500"
                                        }}>
                                            {item.label}
                                        </span>
                                        <div style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "8px"
                                        }}>
                                            <div style={{
                                                width: "24px",
                                                height: "24px",
                                                borderRadius: "6px",
                                                background: item.value,
                                                border: "2px solid rgba(255,255,255,0.1)"
                                            }} />
                                            <IconButton
                                                onClick={item.onReset}
                                                style={{
                                                    padding: "4px",
                                                    color: "rgba(255,255,255,0.5)",
                                                    transition: "all 0.2s ease"
                                                }}
                                                size="small"
                                            >
                                                <Replay style={{ width: 16, height: 16 }} />
                                            </IconButton>
                                        </div>
                                    </div>
                                    <MuiColorInput
                                        value={item.value}
                                        onChange={item.onChange}
                                        format="rgb"
                                        isAlphaHidden
                                        sx={{
                                            width: "100%",
                                            '& .MuiInputBase-root': {
                                                background: 'rgba(255,255,255,0.1)',
                                                borderRadius: '8px',
                                                border: 'none',
                                                color: '#fff',
                                                fontSize: '13px',
                                                '&:hover': {
                                                    background: 'rgba(255,255,255,0.15)'
                                                },
                                                '& .MuiOutlinedInput-notchedOutline': {
                                                    border: 'none'
                                                }
                                            },
                                            '& .MuiInputAdornment-root': {
                                                '& .MuiButtonBase-root': {
                                                    borderRadius: '6px',
                                                    overflow: 'hidden'
                                                }
                                            }
                                        }}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Shortcuts */}
                    <div style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "24px"
                    }}>
                        <div style={{ 
                            color: "#A8AFB3", 
                            fontSize: "14px",
                            fontWeight: "500",
                            textTransform: "uppercase",
                            letterSpacing: "0.5px"
                        }}>
                            Shortcuts
                        </div>

                        <div style={{
                            background: "rgba(255,255,255,0.05)",
                            borderRadius: "12px",
                            padding: "16px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "12px"
                        }}>
                            {[
                                { key: "SPACE", action: "Start/Stop animation" },
                                { key: "R", action: "Clear path" },
                                { key: "Arrows", action: "Animation playback" }
                            ].map((shortcut, index) => (
                                <div key={index} style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    padding: "8px 0",
                                    borderBottom: index !== 2 ? "1px solid rgba(255,255,255,0.1)" : "none"
                                }}>
                                    <div style={{
                                        backgroundColor: "rgba(255,255,255,0.1)",
                                        padding: "4px 8px",
                                        borderRadius: "6px",
                                        color: "#fff",
                                        fontSize: "13px",
                                        fontWeight: "500",
                                        letterSpacing: "0.5px",
                                        minWidth: "70px",
                                        textAlign: "center"
                                    }}>
                                        {shortcut.key}
                                    </div>
                                    <span style={{
                                        color: "rgba(255,255,255,0.7)",
                                        fontSize: "14px"
                                    }}>
                                        {shortcut.action}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <Button
                            onClick={() => {setActiveStep(0);setShowTutorial(true);}}
                            variant="contained"
                            sx={{
                                backgroundColor: "rgba(255,255,255,0.1)",
                                color: "#fff",
                                textTransform: "none",
                                fontWeight: "500",
                                padding: "10px 20px",
                                borderRadius: "8px",
                                '&:hover': {
                                    backgroundColor: "rgba(255,255,255,0.15)"
                                }
                            }}
                        >
                            Show tutorial
                        </Button>
                    </div>

                </div>
            </Backdrop>

            {/* <Drawer
                className={`side-drawer ${cinematic ? "cinematic" : ""}`}
                anchor="left"
                open={sidebar}
                onClose={() => {setSidebar(false);}}
            > */}

            <Backdrop
                // anchor="left"
                open={showTutorial}
                onClick={e => {if(e.target.classList.contains("backdrop")) setShowTutorial(false);}}
                className="backdrop"
            >
                <div className="tutorial-container">
                    <Stepper activeStep={activeStep}>
                        <Step>
                            <StepLabel>Basic controls</StepLabel>
                        </Step>
                        <Step>
                            <StepLabel>Playback controls</StepLabel>
                        </Step>
                        <Step>
                            <StepLabel>Changing settings</StepLabel>
                        </Step>
                    </Stepper>
                    <div className="content">
                        <h1>Map Pathfinding Visualizer</h1>
                        {activeStep === 0 && <div>
                            <p>
                                <b>Controls:</b> <br/>
                                <b>Left button:</b> Place start node <br/>
                                <b>Right button:</b> Place end node <br/>
                            </p>
                            <p>The end node must be placed within the shown radius.</p>
                            <video className="video" autoPlay muted loop>
                                <source src="./videos/tutorial1.mp4" type="video/mp4"/>
                            </video>
                        </div>}
                        {activeStep === 1 && <div>
                            <p>
                                To start the visualization, press the <b>Start Button</b> or press <b>Space</b>.<br/>
                                A playback feature is available after the algorithm ends.
                            </p>
                            <video className="video" autoPlay muted loop>
                                <source src="./videos/tutorial2.mp4" type="video/mp4"/>
                            </video>
                        </div>}
                        {activeStep === 2 && <div>
                            <p>
                                You can customize the settings of the animation in the <b>Settings Sidebar</b>. <br/>
                                Try to keep the area radius only as large as you need it to be. <br/>
                                Anything above <b>10km</b> is considered experimental, if you run into performance issues, stop the animation and clear the path.
                            </p>
                            <video className="video" autoPlay muted loop>
                                <source src="./videos/tutorial3.mp4" type="video/mp4"/>
                            </video>
                        </div>}
                    </div>
                    <div className="controls">
                        <Button onClick={() => {setShowTutorial(false);}}
                            className="close" variant="outlined" style={{ borderColor: "#9f9f9f", color: "#9f9f9f", paddingInline: 15 }}
                        >
                            Close
                        </Button>
                        <Button onClick={() => {handleTutorialChange(-1);}}
                            variant="outlined" style={{ borderColor: "#9f9f9f", color: "#9f9f9f", paddingInline: 18 }}
                        >
                                Back
                        </Button>
                        <Button onClick={() => {handleTutorialChange(1);}}
                            variant="contained" style={{ backgroundColor: "#46B780", color: "#fff", paddingInline: 30, fontWeight: "bold" }}
                        >
                            {activeStep >= 2 ? "Finish" : "Next"}
                        </Button>
                    </div>
                </div>
            </Backdrop>

        </>
    );
});

Interface.displayName = "Interface";

export default Interface;
