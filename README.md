# Music-Translator

### Why did I Create this project?
My goal was for individuals to be able to explore new genres, and understand/appreciate the signficance and richness of lyrics in other songs.

### Check out the project!
I appreciate all the feedback.

Link - [dukz8h8o1lsds.cloudfront.net]

### How does it work?
 1. First, this project links your music to Spotify account. We use spotify to to get track information, and allow you to play music directly from the project itself. 
 2. Then, it fetches LRC lyrics from an API called LRCLIB. 
 3. This project translates lyrics in 2 ways.  
    
    a. For simpler translations, google translate is used. 
    
    b. For more advanced translation, like romanized text or more complex languages, I utilized an AI model to be able to provide accurate and engaging translations to the lyrics.


 ### Tech stack
    Frontend - React, Typescript
    Backend - Node JS
    API's used - Google Gemini, LRCLIB, Google Translate, Spotify

    Hosting: AWS S3, AWS Cloudfront, Render (backend), 


### Notable Challenges 

One notable challenge that I faced was determining how I wanted to translate lyrics. I compared the benefits and drawbacks of word by word, line by line, and literal vs more nuanced translations. Thanks to my friend Aneesh's help, I ended up translating line by line, as the user would be able to understand the context and nuance of lyrics, compared to other translations (like everyday language). Overall, this was a very fun project to undertake because the documentation for these resources were very clear and helpful.

### Next Steps
I really want this project to work on mobile devices, as now it only works on laptops (Google Chrome & Firefox), due to DRM constraints. My next step will be to make this project as accessible as possible.