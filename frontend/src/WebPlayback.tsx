import React, { useState, useEffect } from 'react';
import Lyrics from "./Lyrics.tsx";

const track = {
    name: "",
    album: {
        images: [
            { url: "" }
        ]
    },
    artists: [
        { name: "" }
    ]
}



function WebPlayback(props) {

    const [player, setPlayer] = useState(undefined);
    const [is_paused, setPaused] = useState(false);
    const [is_active, setActive] = useState(false);
    const [current_track, setTrack] = useState(track);
    const [volume, setVolume] = useState(0);

    const [currentState, setCurrentState] = useState(undefined);

    const [position, setPosition] = useState(0); // in seconds
    const [lastUpdateTime, setLastUpdateTime] = useState(null);



    const [authenticate , setAuthenticate] = useState(true);



    useEffect(() => {


        const script = document.createElement("script");
        script.src = "https://sdk.scdn.co/spotify-player.js";
        script.async = true;

        document.body.appendChild(script);

        window.onSpotifyWebPlaybackSDKReady = () => {

            const player = new window.Spotify.Player({
                name: 'Web Playback SDK',
                getOAuthToken: cb => { cb(props.token); },
                volume: 0.5
            });

            setPlayer(player);

            player.addListener('ready', ({ device_id }) => {
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

            
            player.addListener('not_ready', ({ device_id }) => {
                console.log('Device ID has gone offline', device_id);
            });


            player.connect();

            player.setName("Translator Web Service")


            player.addListener('player_state_changed', (state) => {
                if (!state) {
                    setActive(false);
                    return;
                }

                setActive(true);
                setPaused(state.paused);
                setTrack(state.track_window.current_track);

                setCurrentState(state);

                setPosition(state.position);
                setLastUpdateTime(Date.now());
            });



            player.getVolume().then(volume => {
                setVolume(volume);
            })

            player.on('authentication_error', ({ message }) => {
                console.error('Failed to authenticate', message);
                setAuthenticate(false);
            });

            


        };
    }, []);


    useEffect(() => {
        if (is_paused || lastUpdateTime === null) return;

        const intervalId = setInterval(() => {
            setPosition(prev =>
                prev + (Date.now() - lastUpdateTime)
            );
            setLastUpdateTime(Date.now());
        }, 1000);

        return () => clearInterval(intervalId);
    }, [is_paused, lastUpdateTime]);




   return (
    <>
        <div className="container">
            <div className="main-wrapper">
                
                {authenticate == false ? <a className="btn-spotify" href="/auth/login" >
                    Reauthenticate with Spotify 
                </a> : <p> </p>}


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

                <button className="btn-spotify" disabled={!is_active} onClick={() => {  player && player.previousTrack() }} >
                    &lt;&lt;
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
                    { is_paused ? "PLAY" : "PAUSE" }
                </button>

                <button className="btn-spotify" disabled={!is_active} onClick={() => { player && player.nextTrack() }} >
                    &gt;&gt;
                </button>

                 

                <div  className='volume'>
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

                        
                    }} > up </button> 



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
                        
                    }} > down </button>        
                </div>


            </div>
            
             {player && is_active && current_track.name && (
                <Lyrics track={current_track} position={position} />
            )}

            

            <p>Signed in and have token</p>
        </div>
     </>
)

}

export default WebPlayback
