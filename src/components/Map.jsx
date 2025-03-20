import DeckGL from "@deck.gl/react";
import { Map as MapGL } from "react-map-gl";
import maplibregl from "maplibre-gl";
import { PolygonLayer, ScatterplotLayer } from "@deck.gl/layers";
import { FlyToInterpolator } from "deck.gl";
import { TripsLayer } from "@deck.gl/geo-layers";
import { createGeoJSONCircle } from "../helpers";
import { useEffect, useRef, useState, useMemo } from "react";
import { getBoundingBoxFromPolygon, getMapGraph, getNearestNode } from "../services/MapService";
import PathfindingState from "../models/PathfindingState";
import Interface from "./Interface";
import { INITIAL_COLORS, INITIAL_VIEW_STATE, MAP_STYLE } from "../config";
import useSmoothStateChange from "../hooks/useSmoothStateChange";

function Map() {
    const [startNode, setStartNode] = useState(null);
    const [endNode, setEndNode] = useState(null);
    const [selectionRadius, setSelectionRadius] = useState([]);
    const [tripsData, setTripsData] = useState([]);
    const [started, setStarted] = useState();
    const [time, setTime] = useState(0);
    const [animationEnded, setAnimationEnded] = useState(false);
    const [playbackOn, setPlaybackOn] = useState(false);
    const [playbackDirection, setPlaybackDirection] = useState(1);
    const [fadeRadiusReverse, setFadeRadiusReverse] = useState(false);
    const [cinematic, setCinematic] = useState(false);
    const [placeEnd, setPlaceEnd] = useState(false);
    const [loading, setLoading] = useState(false);
    const [settings, setSettings] = useState({ algorithm: "astar", radius: 4, speed: 5 });
    const [colors, setColors] = useState(INITIAL_COLORS);
    const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
    const ui = useRef();
    const fadeRadius = useRef();
    const requestRef = useRef();
    const previousTimeRef = useRef();
    const timer = useRef(0);
    const waypoints = useRef([]);
    const state = useRef(new PathfindingState());
    const traceNode = useRef(null);
    const traceNode2 = useRef(null);
    const selectionRadiusOpacity = useSmoothStateChange(0, 0, 1, 400, fadeRadius.current, fadeRadiusReverse);
    const [endpointFound, setEndpointFound] = useState(false);
    const [finalPath, setFinalPath] = useState(null);
    const [explorationPaths, setExplorationPaths] = useState(null);
    const [isReplayingAnimation, setIsReplayingAnimation] = useState(false);

    async function mapClick(e, info, radius = null) {
        if(started && !animationEnded) return;

        setFadeRadiusReverse(false);
        fadeRadius.current = true;
        clearPath();

        // Place end node
        if(info.rightButton || placeEnd) {
            if(e.layer?.id !== "selection-radius") {
                ui.current.showSnack("Please select a point inside the radius.", "info");
                return;
            }

            if(loading) {
                ui.current.showSnack("Please wait for all data to load.", "info");
                return;
            }

            const loadingHandle = setTimeout(() => {
                setLoading(true);
            }, 300);
            
            const node = await getNearestNode(e.coordinate[1], e.coordinate[0]);
            if(!node) {
                ui.current.showSnack("No path was found in the vicinity, please try another location.");
                clearTimeout(loadingHandle);
                setLoading(false);
                return;
            }

            const realEndNode = state.current.getNode(node.id);
            setEndNode(node);
            
            clearTimeout(loadingHandle);
            setLoading(false);

            if(!realEndNode) {
                ui.current.showSnack("An error occurred. Please try again.");
                return;
            }
            state.current.endNode = realEndNode;
            
            return;
        }

        const loadingHandle = setTimeout(() => {
            setLoading(true);
        }, 300);

        // Fectch nearest node
        const node = await getNearestNode(e.coordinate[1], e.coordinate[0]);
        if(!node) {
            ui.current.showSnack("No path was found in the vicinity, please try another location.");
            clearTimeout(loadingHandle);
            setLoading(false);
            return;
        }

        setStartNode(node);
        setEndNode(null);
        const circle = createGeoJSONCircle([node.lon, node.lat], radius ?? settings.radius);
        setSelectionRadius([{ contour: circle}]);
        
        // Fetch nodes inside the radius
        getMapGraph(getBoundingBoxFromPolygon(circle), node.id).then(graph => {
            state.current.graph = graph;
            clearPath();
            clearTimeout(loadingHandle);
            setLoading(false);
        });
    }

    // Start new pathfinding animation
    function startPathfinding() {
        setFadeRadiusReverse(true);
        setTimeout(() => {
            clearPath();
            state.current.start(settings.algorithm);
            setStarted(true);
        }, 400);
    }

    // Start or pause already running animation
    function toggleAnimation(loop = true, direction = 1) {
        if(time === 0 && !animationEnded) return;
        setPlaybackDirection(direction);
        if(animationEnded) {
            if(loop && time >= timer.current) {
                setTime(0);
            }
            setStarted(true);
            setPlaybackOn(!playbackOn);
            return;
        }
        setStarted(!started);
        if(started) {
            previousTimeRef.current = null;
        }
    }

    function clearPath() {
        setStarted(false);
        setTripsData([]);
        setTime(0);
        state.current.reset();
        waypoints.current = [];
        timer.current = 0;
        previousTimeRef.current = null;
        traceNode.current = null;
        traceNode2.current = null;
        setAnimationEnded(false);
        setEndpointFound(false);
        setFinalPath(null);
        setExplorationPaths(null);
        setIsReplayingAnimation(false);
    }

    // Progress animation by one step
    function animateStep(newTime) {
        const updatedNodes = state.current.nextStep();
        for(const updatedNode of updatedNodes) {
            updateWaypoints(updatedNode, updatedNode.referer);
        }

        // Found end but waiting for animation to end
        if(state.current.finished && !animationEnded) {
            // Render route differently for bidirectional
            if(settings.algorithm === "bidirectional") {
                if(!traceNode.current) traceNode.current = updatedNodes[0];
                const parentNode = traceNode.current.parent;
                updateWaypoints(parentNode, traceNode.current, "route", Math.max(Math.log2(settings.speed), 1));
                traceNode.current = parentNode ?? traceNode.current;

                if(!traceNode2.current) {
                    traceNode2.current = updatedNodes[0];
                    traceNode2.current.parent = traceNode2.current.prevParent;
                }
                const parentNode2 = traceNode2.current.parent;
                updateWaypoints(parentNode2, traceNode2.current, "route", Math.max(Math.log2(settings.speed), 1));
                traceNode2.current = parentNode2 ?? traceNode2.current;
                setAnimationEnded(time >= timer.current && parentNode == null && parentNode2 == null);
            }
            else {
                if(!traceNode.current) traceNode.current = state.current.endNode;
                const parentNode = traceNode.current.parent;
                updateWaypoints(parentNode, traceNode.current, "route", Math.max(Math.log2(settings.speed), 1));
                traceNode.current = parentNode ?? traceNode.current;
                setAnimationEnded(time >= timer.current && parentNode == null);
            }
        }

        // Animation progress
        if (previousTimeRef.current != null && !animationEnded) {
            const deltaTime = newTime - previousTimeRef.current;
            setTime(prevTime => (prevTime + deltaTime * playbackDirection));
        }

        // Playback progress
        if(previousTimeRef.current != null && animationEnded && playbackOn) {
            const deltaTime = newTime - previousTimeRef.current;
            if(time >= timer.current && playbackDirection !== -1) {
                setPlaybackOn(false);
            }
            setTime(prevTime => (Math.max(Math.min(prevTime + deltaTime * 2 * playbackDirection, timer.current), 0)));
        }
    }

    // Animation callback
    function animate(newTime) {
        for(let i = 0; i < settings.speed; i++) {
            animateStep(newTime);
        }

        previousTimeRef.current = newTime;
        requestRef.current = requestAnimationFrame(animate);
    }

    // Add new node to the waypoitns property and increment timer
    function updateWaypoints(node, refererNode, color = "path", timeMultiplier = 1) {
        if(!node || !refererNode) return;
        const distance = Math.hypot(node.longitude - refererNode.longitude, node.latitude - refererNode.latitude);
        const timeAdd = distance * 50000 * timeMultiplier;

        waypoints.current = [...waypoints.current,
            {
                path: [[refererNode.longitude, refererNode.latitude], [node.longitude, node.latitude]],
                timestamps: [timer.current, timer.current + timeAdd],
                color,
                discoveryTime: timer.current // Add discovery time to track when node was found
            }
        ];

        timer.current += timeAdd;
        setTripsData(() => waypoints.current);
    }

    useEffect(() => {
        if (state.current.finished && animationEnded) {
            setExplorationPaths([...tripsData]);
            // Wait a bit to ensure all paths are drawn
            setTimeout(() => {
                setEndpointFound(true);
                // Keep all paths as they are, including the final route
                setFinalPath([...tripsData]);
            }, 500);
        }
    }, [state.current.finished, animationEnded, tripsData, time]);

    useEffect(() => {
        if (timer.current !== null && explorationPaths) {
            setIsReplayingAnimation(true);
        } else {
            setIsReplayingAnimation(false);
        }
    }, [timer.current]);

    const visibleTripsData = useMemo(() => {
        // If replaying animation, show exploration paths
        if (isReplayingAnimation && explorationPaths) {
            return explorationPaths;
        }
        
        // If endpoint not found or no final path, show current paths
        if (!endpointFound || !finalPath) {
            return tripsData;
        }
        
        // Show all paths as they were found
        return finalPath;
    }, [endpointFound, finalPath, tripsData, explorationPaths, isReplayingAnimation]);

    function changeLocation(location) {
        setViewState({ ...viewState, longitude: location.longitude, latitude: location.latitude, zoom: 5,transitionDuration: 1, transitionInterpolator: new FlyToInterpolator()});
    }

    function changeSettings(newSettings) {
        setSettings(newSettings);
        const items = { settings: newSettings, colors };
        localStorage.setItem("path_settings", JSON.stringify(items));
    }

    function changeColors(newColors) {
        setColors(newColors);
        const items = { settings, colors: newColors };
        localStorage.setItem("path_settings", JSON.stringify(items));
    }

    function changeAlgorithm(algorithm) {
        clearPath();
        changeSettings({ ...settings, algorithm });
    }

    function changeRadius(radius) {
        changeSettings({...settings, radius});
        if(startNode) {
            mapClick({coordinate: [startNode.lon, startNode.lat]}, {}, radius);
        }
    }

    useEffect(() => {
        if(!started) return;
        requestRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(requestRef.current);
    }, [started, time, animationEnded, playbackOn]);

    useEffect(() => {
        navigator.geolocation.getCurrentPosition(res => {
            changeLocation(res.coords);
        });

        const settings = localStorage.getItem("path_settings");
        if(!settings) return;
        const items = JSON.parse(settings);

        setSettings(items.settings);
        setColors(items.colors);
    }, []);

    return (
        <>
            <div onContextMenu={(e) => { e.preventDefault(); }}>
                <DeckGL
                    initialViewState={viewState}
                    controller={{ doubleClickZoom: false, keyboard: false }}
                    onClick={mapClick}
                >
                    <PolygonLayer
                        id={"selection-radius"}
                        data={selectionRadius}
                        pickable={true}
                        stroked={true}
                        getPolygon={d => d.contour}
                        getFillColor={[80, 210, 0, 10]}
                        getLineColor={[9, 142, 46, 175]}
                        getLineWidth={3}
                        opacity={selectionRadiusOpacity}
                    />
                    <TripsLayer
                        id={"pathfinding-layer"}
                        data={visibleTripsData}
                        opacity={1}
                        widthMinPixels={4}
                        widthMaxPixels={4}
                        fadeTrail={false}
                        currentTime={time}
                        getColor={(d) => {
                            if(d.color !== "path") return colors[d.color];

                            const timeSinceDiscovery = Math.abs(time - d.discoveryTime);

                            // Longer fade-out duration for a softer trail
                            // const fadeOutDuration = (d.discoveryTime) + 5000; // some seconds fade out
                            // const fadeOutDuration = 5000; // 5 seconds fade out
                            // const fadeOutDuration = d.discoveryTime + (Date.now() % 5); // Varies every second
                            // const fadeOutDuration = d.discoveryTime * (Math.random() * 0.5 + 1); // Between 100% and 150% of discoveryTime
                            const fadeOutDuration = d.discoveryTime + Math.floor(Math.random() * 5000) + 3000; // Random value between 3s and 8s

                            const peakGlowDuration = 300; // Time at peak brightness

                            // Calculate base glow intensity with longer fade
                            let glowIntensity = 0;
                            if ((timeSinceDiscovery) < fadeOutDuration) {
                                if (timeSinceDiscovery < peakGlowDuration) {
                                    // Quick ramp up to peak brightness
                                    glowIntensity = Math.min(1, timeSinceDiscovery / 100);
                                } else {
                                    // Exponential decay for a softer fade-out
                                    const fadeProgress = (timeSinceDiscovery - peakGlowDuration) / (fadeOutDuration - peakGlowDuration);
                                    glowIntensity = Math.exp(-fadeProgress * 2);
                                }

                                // Add subtle oscillation to the glow
                                const oscillation = Math.sin(timeSinceDiscovery * 0.01) * 0.1 + 0.9;
                                glowIntensity *= oscillation;
                            }

                            // Create a warm orange glow effect
                            const baseColor = colors[d.color];

                            return baseColor.map((c, i) => {
                                if (glowIntensity > 0) {
                                    const glowAmount = glowIntensity * 600;
                                    if (i === 0) { // Red channel - boost significantly for orange glow
                                        return Math.min(255, c + glowAmount * 1.4);
                                    } else if (i === 1) { // Green channel - reduce more for orange tint
                                        return Math.min(255, c + glowAmount * 0.7);
                                    } else { // Blue channel - minimal for warm glow
                                        return Math.min(255, glowAmount * 0.2);
                                    }
                                }
                                return c * 0.5; // Dimmer base color for more contrast
                            });
                        }}
                        updateTriggers={{
                            getColor: [colors.path, colors.route, time]
                        }}
                    />
                    <ScatterplotLayer
                        id="start-end-points"
                        data={[
                            ...(startNode ? [{ coordinates: [startNode.lon, startNode.lat], color: colors.startNodeFill, lineColor: colors.startNodeBorder }] : []),
                            ...(endNode ? [{ coordinates: [endNode.lon, endNode.lat], color: colors.endNodeFill, lineColor: colors.endNodeBorder }] : []),
                        ]}
                        pickable={true}
                        opacity={1}
                        stroked={true}
                        filled={true}
                        radiusScale={1}
                        radiusMinPixels={7}
                        radiusMaxPixels={20}
                        lineWidthMinPixels={1}
                        lineWidthMaxPixels={3}
                        getPosition={d => d.coordinates}
                        getFillColor={d => d.color}
                        getLineColor={d => d.lineColor}
                    />
                    <MapGL
                        reuseMaps mapLib={maplibregl}
                        mapStyle={MAP_STYLE}
                        doubleClickZoom={false}
                    />
                </DeckGL>
            </div>
            <Interface
                ref={ui}
                canStart={startNode && endNode}
                started={started}
                animationEnded={animationEnded}
                playbackOn={playbackOn}
                time={time}
                startPathfinding={startPathfinding}
                toggleAnimation={toggleAnimation}
                clearPath={clearPath}
                timeChanged={setTime}
                changeLocation={changeLocation}
                maxTime={timer.current}
                settings={settings}
                setSettings={changeSettings}
                changeAlgorithm={changeAlgorithm}
                colors={colors}
                setColors={changeColors}
                loading={loading}
                cinematic={cinematic}
                setCinematic={setCinematic}
                placeEnd={placeEnd}
                setPlaceEnd={setPlaceEnd}
                changeRadius={changeRadius}
            />
            <div className="attrib-container"><summary className="maplibregl-ctrl-attrib-button" title="Toggle attribution" aria-label="Toggle attribution"></summary><div className="maplibregl-ctrl-attrib-inner">  <a href="https://carto.com/about-carto/" target="_blank" rel="noopener">CARTO</a>,  <a href="http://www.openstreetmap.org/about/" target="_blank">OpenStreetMap</a> contributors</div></div>
        </>
    );
}

export default Map;