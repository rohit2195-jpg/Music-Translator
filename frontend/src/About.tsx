import { Link } from "react-router-dom";
import './About.css';
import album_img from '../public/Michael_Jackson_-_Thriller.png'

function About() {

    return (<div style={{textAlign: 'left',}}>
        <p style={{color: 'black', fontSize: 30, fontWeight: 'bold', }}> About page</p>
        <Link to="/">Home</Link>

        <div className="first-row">

            <div className="question-answer">
                <p style={{ fontSize: 15, fontWeight: 'bold' }}>
                    Why did I create this project?
                </p>

                <p>
                    There are so many beautiful songs in other languages, that have such meaningful lyrics.
                    <br /><br />
                    The reason why I created this project was for individuals to be able to explore new genres, and understand/appreciate the significance and richness of lyrics in other songs.
                    <br /><br />
                    I also think that this tool can be very valuable for individuals learning new languages.
                    <br /><br />
                    I hope you enjoy this musical journey, and find comfort in the powerful lyrics from a diverse group of individuals and genres.
                </p>

              
            </div>

            <div className="thriller-image">
                <img src={album_img}></img>

            </div>






        </div>


        

        <p style={{fontStyle: 'italic', alignContent: 'center', textAlign: 'center', }}>
                When a painter copies from the life... he has no privilege to alter features and lineaments...
        </p>

        
    </div>
    )
}

export default About;