import React, { useState, useEffect } from 'react';
import Lyrics from "./Lyrics.tsx";
import { CiPlay1, CiPause1 } from "react-icons/ci";
import { CgPlayTrackNext,CgPlayTrackPrev } from "react-icons/cg";
import { FaVolumeUp, FaVolumeDown } from "react-icons/fa";

import './WebPlayback.css';
import Login from './Login.tsx';

const track = {
    name: "",
    album: {
        images: [
            { url: "" }
        ]
    },
    artists: [
        { name: "" }
    ],
    id:"",

}

interface MyProp {
    token: string;
    setToken: any;
}

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady: () => void;
    Spotify: any;
  }
}


function WebPlayback(props: MyProp) {

    const [player, setPlayer] = useState<any>(undefined);
    const [is_paused, setPaused] = useState(false);
    const [is_active, setActive] = useState(false);
    const [current_track, setTrack] = useState<any>(track);
    const [volume, setVolume] = useState(0);

    const [currentState, setCurrentState] = useState<any>(undefined);

    const [position, setPosition] = useState(0); // in milliseconds
    const lastUpdateRef = React.useRef<any>(null);

    




    const [authenticate , setAuthenticate] = useState(true);

    var progressPercent = currentState ? (position / (currentState["track_window"]["current_track"]["duration_ms"] ) * 100 ): 0;



    useEffect(() => {


        const script = document.createElement("script");
        script.src = "https://sdk.scdn.co/spotify-player.js";
        script.async = true;

        document.body.appendChild(script);

        window.onSpotifyWebPlaybackSDKReady = () => {

            const player = new window.Spotify.Player({
                name: 'Web Playback SDK',
                getOAuthToken: (cb: any) => { cb(props.token); },
                volume: 0.5
            });

            setPlayer(player);

            player.addListener('ready', ({ device_id }:any) => {
                console.log('Ready with Device ID', device_id);
                fetch('https://api.spotify.com/v1/me/player', {
                    method: 'PUT',
                    headers: {
                    'Authorization': `Bearer ${props.token}`,
                    'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                    device_ids: [device_id],
                    play: false,
                    }),
                });

                setActive(true);
            });

            
            player.addListener('not_ready', ({ device_id }: any) => {
                console.log('Device ID has gone offline', device_id);
            });


            player.connect();

            player.setName("Translator Web Service")


            player.addListener("player_state_changed", (state : any) => {
                if (!state) return;

                setActive(true);
                setPaused(state.paused);
                setTrack(state.track_window.current_track);
                setCurrentState(state);

                setPosition(state.position); // ms
                console.log(state.track_window.current_track);
                console.log(state.position);
                lastUpdateRef.current = Date.now();
            });




            player.getVolume().then((volume: React.SetStateAction<number>) => {
                setVolume(volume);
            })

            player.on('authentication_error', ({ message }: any) => {
                console.error('Failed to authenticate', message);
                setAuthenticate(false);
            });

            


        };
    }, []);


    useEffect(() => {
        if (is_paused) return;

        const interval = setInterval(() => {
            if (!lastUpdateRef.current) return;

            const now = Date.now();
            const elapsed = now - lastUpdateRef.current;

            setPosition(prev => prev + elapsed);
            lastUpdateRef.current = now;
        }, 500);

        return () => clearInterval(interval);
    }, [is_paused]);


    // ask user to reauthenticate if not logged in

    if (!player || is_active == false || authenticate == false)  {
        return (<div className='btn-spotify-login'>
            <Login></Login>
            </div>)
    }




   return (
    <>
        <div className="container">
            <div className="main-wrapper">
                
            

                {current_track?.album?.images?.[0]?.url?.trim() || null ? (
                <img
                    src={current_track?.album?.images?.[0]?.url?.trim() || null}
                    className="now-playing__cover"
                    alt="Album art"
                />
                ) : null}


                




                <div className="now-playing__side">
                    <div className="now-playing__name">{
                                  current_track.name
                                  }</div>

                    <div className="now-playing__artist">{
                                  current_track.artists[0].name
                                  }</div>
                    <div className= "currentPos">
                        {Math.floor(position / 1000)}


                    </div>


                    

                </div>

                <div className="progress-container">
                    {Math.floor(position / 1000  / 60) }:{String(Math.floor((position / 1000) % 60)).padStart(2, '0')}

                    <div
                        className="progress-bar"
                        onClick={(e) => {
                            console.log('changing position')
                            if (!player || !currentState) return;

                            const rect = e.currentTarget.getBoundingClientRect();
                            const clickX = e.clientX - rect.left;
                            const newPosition = (clickX / rect.width) * currentState.track_window.current_track.duration_ms;

                            player.seek(newPosition);
                        }}
                        >
                        <div
                            className="progress-bar__fill"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>

                </div>




                <button className="btn-spotify" disabled={!is_active} onClick={() => {  player && player.previousTrack() }} >
                    <CgPlayTrackPrev></CgPlayTrackPrev>
                </button>


                <button className="btn-spotify" disabled={!is_active} onClick={() => {
                    if (!player) return;

                    if (is_paused) {
                        fetch('https://api.spotify.com/v1/me/player/play', {
                        method: 'PUT',
                        headers: {
                            'Authorization': `Bearer ${props.token}`,
                        },
                        });
                    } else {
                        fetch('https://api.spotify.com/v1/me/player/pause', {
                        method: 'PUT',
                        headers: {
                            'Authorization': `Bearer ${props.token}`,
                        },
                        });
                    }
                }}>
                    { is_paused ? <CiPlay1></CiPlay1> : <CiPause1></CiPause1>}
                </button>

                <button className="btn-spotify" disabled={!is_active} onClick={() => { player && player.nextTrack() }} >
                    <CgPlayTrackNext></CgPlayTrackNext>
                </button>


                

                 

                <div  className='volume'>


                    <button disabled={!is_active} className='vol-down' onClick={() => {
                        var new_volume = volume - 0.1;
                        console.log(new_volume)
                        if (player) {

                            if (new_volume < 0) {
                                player.setVolume(0);
                                setVolume(0)
                            }
                            else {
                                player.setVolume(new_volume);
                                setVolume(new_volume)
                            }

                        }
                        
                    }} > <FaVolumeDown></FaVolumeDown> </button>   


                    <button disabled={!is_active} className='vol-up' onClick={() => {
                        var new_volume = volume + 0.1;
                        console.log(new_volume)
                        if (player) {
                            if (new_volume > 1) {
                                player.setVolume(1);
                                setVolume(1)
                            }
                            else {
                                player.setVolume(new_volume);
                                setVolume(new_volume)
                            }
                        }

                        
                    }} > <FaVolumeUp></FaVolumeUp> </button> 



                         
                </div>

                {player && is_active && current_track.name && (
                <Lyrics track={current_track} position={position} />
                )}


            </div>
            
             

            <p>Welcome</p>

        </div>
     </>
)

}

export default WebPlayback
