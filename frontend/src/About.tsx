import { Link } from "react-router-dom";

function About() {

    return (<div style={{textAlign: 'left',}}>
        <p style={{color: 'black', fontSize: 20,}}> About page</p>
        <Link to="/">Home</Link>

        <p> 
            <div style={{fontSize: 15,fontWeight: 'bold',}}>
                Why did I create this project?
            </div>
            <br></br>
            
            There are so many beautiful songs in other languages, that have such meaningful lyrics. 
            <br></br>
            <br></br>
            The reason why I created this project was for individuals to be able to explore new genres, and understand/appreciate the signficance and richness of lyrics in other songs
            <br></br>
            <br></br>
            I also think that this tool can be very valuable for individuals learning new languages. 
<br></br>
<br></br>
            I hope you enjoy this musical journey, and find comfort in the powerful lyrics from a diverse group of individuals and genres.



            </p>

            If you need any song reccomendations with emotionally rich/meaningful lyrics: Tujh Mein Rab Dikhta Hai and Mari Antaga 

            <p style={{fontStyle: 'italic'}}>
                When a painter copies from the life... he has no privilege to alter features and lineaments...
            </p>
    </div>
    )
}

export default About;