First and Last Name
  Hunter Quant
Date
  03/02/2016

Description of implementation

  Controls
    Use WASD or the arrow keys to move the main character

  Objective
    Obtain a high score by collection bubbles.
    Larger bubbles give more points.
    You get a score multiplier for every second alive.
    The yellow circles are bubble bombs and clear the screen of bubbles.
    The black blocks are dangerous, hit one and it's game over.

  Globals will be referenced through description.

    var gl;
    var shaderProgram;
    // Main character
    var flatz;
    // Array of bubbles
    var bubbles;
    // Bubble bomb object
    var bubbleBomb;
    // Key mapping object for multiple input keys
    var keyMapping;
    // HTML elements to display information
    var scoreText;
    var timeText;
    var highText;
    var poppedText;
    // Current score
    var score;
    // Score multiplier
    var scoreMultiplier;
    // The base time value
    var time;
    // The locally saved high Score
    var highScore;
    // The number of popped bubbles
    var popped;
    // Callback function that returns the remaining time
    var timeRemaining;
    // Boolean for playstate
    var playing;
    // Boolean for if the player has game overed.
    var gameOver;
    // Game music
    var song;

    DISCLAIMER: I'm not the most proficient in Javascript, so my code might not follow certain standards or be the most efficient.

    The game fist initializes all the above globals and then calls the game loop.

    The game loop first clears the screen and if the playing status is true it
    executes the game logic. The following is the steps preformed in the game loop.

      - Check and update the game timer
      - Update player position based on status of key presses.
      - Randomly generate a value to be used as the radius.
      - Generate a bubble if the calculated value is less than 0.25.
      - Generate a bubble bomb if the radius is less than 0.0015 and there is not
        currently a bubble bomb on the play field.
      - Generate a danger block if the radius is less than 0.02.
      - A function called drawFlatz is called to draw the main character.
      - For each of the bubbles in the bubble list
        - Call the collision handling function for the bubble.
        - Call the draw function fot the bubble.
        - Call the update function for the bubble.
      - If there is a bubble bomb
        - Handle its collision
        - Draw it
        - Update the bubble bomb position
      - For each of the danger blocks in the danger blocks list
        - Call the collision handling function for the danger block.
        - Call the draw function for the danger block.
        - Call the update function for the danger block.
      - Request next frame.

    Flatz is 3 collections of vertices to form his body. The 3 collections have
    the same transformations applied to them.

    Bubbles are an object with various properties and a set of 16 vertices using
    the equation of a circle.

    Bubble bombs are similar to bubbles, but have 64 vertices to make it look better
    as the radius expands.

    Danger blocks are objects with a set of vertices to make a block and a few
    other properties.

    There is a bit of random values in the code, which was chosen for balancing.
    I won't get too much into the implementation beyond the game loop, because
    it would be long winded. If you want more specific details on function
    implementation the code is fairly well documented.

Credits
  "Voice Over Under" Kevin MacLeod (incompetech.com)
  Licensed under Creative Commons: By Attribution 3.0 License
  http://creativecommons.org/licenses/by/3.0/

  "Punch HD" Mark DiAngelo
  Licensed under Creative Commons: By Attribution 3.0 License
  http://creativecommons.org/licenses/by/3.0/

  "Beep 2" timtube
  Licensed under Creative Commons: By Sampling Plus 1.0 License
  https://creativecommons.org/licenses/sampling+/1.0/
