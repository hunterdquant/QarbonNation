/*
  Name: Hunter Quant
  Course: CS452
  Project: 1
*/

/*
  "Voice Over Under" Kevin MacLeod (incompetech.com)
  Licensed under Creative Commons: By Attribution 3.0 License
  http://creativecommons.org/licenses/by/3.0/

  "Punch HD" Mark DiAngelo
  Licensed under Creative Commons: By Attribution 3.0 License
  http://creativecommons.org/licenses/by/3.0/

  "Beep 2" timtube
  Licensed under Creative Commons: By Sampling Plus 1.0 License
  https://creativecommons.org/licenses/sampling+/1.0/
*/

/* Define globals */
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

/* Initializes WebGL and globals */
function init() {

  // Get reference to html elements
  scoreText = document.getElementById("score");
  timeText = document.getElementById("time");
  highText = document.getElementById("high");
  poppedText = document.getElementById("pop");
  // Set initial score and time values
  score = 0;
  scoreMultiplier = 1;
  time = 60000;
  popped = 0;

  if (localStorage.getItem("highScore") === null) {
    highScore = 0;
  } else {
    highScore = localStorage.getItem("highScore");
  }
  highText.innerHTML = "High: " + Math.floor(highScore);

  // Init webgl and specify clipspace.
  var canvas = document.getElementById("gl-canvas");
  gl = WebGLUtils.setupWebGL(canvas);
  if (!gl) {alert("Web gl is not available");}

  // Set clip space and background color
  gl.viewport(0, 0, 512, 512);
  gl.clearColor(0.9, 0.3, 0.3, 1.0);

  // Set initial play state
  playing = false;
  gameOver = false;

  song = new Audio("VoiceOverUnder.mp3");

  // Initiale character
  initFlatz();

  // Create bubbles array
  bubbles = [];
  // Set bomb initially to null
  bubbleBomb = null;
  dangerBlocks = [];

  // Create keymap object
  keyMapping = {};

  // Initialize the array buffer
  initBuffer();

  // Initialize shaders and start shader program.
  shaderProgram = initShaders(gl, "vertex-shader", "fragment-shader");
  gl.useProgram(shaderProgram);

  // Set myPosition attrib pointer to step through buffer
  var myPosition = gl.getAttribLocation(shaderProgram, "myPosition");
  gl.vertexAttribPointer(myPosition, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(myPosition);

  // Start game loop
  gameLoop();
}

/* Continuously loops for the duration of the play session
   A lot of values in here were chosen based on game balance through play testing
 */
function gameLoop() {

  // Clear drawn elements
  gl.clear(gl.COLOR_BUFFER_BIT);
  // Execute game logic if playing
  if (playing) {
    // Update game timer
    checkGameTime();
    // Update displacement values based on key mappings
    updateKeyInfo();

    // Get random radius with min size
    var radius = Math.random() + 0.05;

    // If the radius is small enough generate a bubble
    if (radius < 0.25)
      generateBubble(radius/2);
    // If the generated radiues is very small and there is not currently a bomb, generate a bomb.
    if (radius < 0.0515 && bubbleBomb === null)
      generateBubbleBomb();
    if (radius < 0.07) {
      generateDangerBlock();
    }


    // Draw the character
    drawFlatz();

    // Handle collision, draw, and update each bubble
    for (var i = bubbles.length - 1; i >= 0; i--) {
      handleBubbleCollision(bubbles[i]);
      drawBubble(bubbles[i]);
      updateBubble(bubbles[i], i);
    }

    // If the bomb exists handle its collision and draw it
    if (bubbleBomb !== null) {
      handleBubbleBombCollision();
      drawBubbleBomb();
      updateBubbleBomb();
    }
    // Handle collision, draw, and update each danger block
    for (i = dangerBlocks.length - 1; i >= 0; i--) {
      handleDangerBlockCollision(dangerBlocks[i]);
      drawDangerBlock(dangerBlocks[i], i);
      updateDangerBlock(dangerBlocks[i], i);
    }
    // Gameover happened this frame them reset the globals.
    if (gameOver) {
      resetGlobals();
      song.pause();
      localStorage.setItem("highScore", highScore);
    }

    poppedText.innerHTML = "Popped: " + popped;
  }
  // If it's game over draw a red X
  if (gameOver) {
    drawX();
  }
  // Update frame
  requestAnimFrame(gameLoop);
}

/* Resets game upon the press of a button */
function startNew() {
  resetGlobals();
  scoreText.innerHTML = "Score: 0";
  timeText.innerHTML = "Time: 0";
  popped = 0;
  gameOver = false;
  song.currentTime = 0;
  song.play();
  // Reset timer
  timeRemaining = timer(time);
  // Change play state
  playing = true;
}

/* resets globals on lose and game start */
function resetGlobals() {
  // Reset all globals
  score = 0;
  time = 60000;
  initFlatz();
  bubbles = [];
  dangerBlocks = [];
  keyMapping = {};
  bubbleBomb = null;
}

/* Checks if another object is colliding with a bubble */
function handleBubbleCollision(bubble) {
  // Check if they are withing the radius + flatz width/height
  if (!bubble.popped && Math.abs(bubble.x - flatz.x) <= bubble.radius + 0.05 && Math.abs(bubble.y - flatz.y) <= bubble.radius + 0.016) {
    // Update the score
    updateScore(bubble);
    // Flad the bubble as popped
    bubble.popped = true;
    var pop = new Audio("Punch_HD-Mark_DiAngelo-1718986183.mp3");
    pop.volume = 10*bubble.getArea();
    pop.play();

    popped++;
  }
  // Check if the bubble is in the blast radius of the bomb if one is exploding
  if (bubbleBomb !== null && bubbleBomb.exploding && !bubble.popped) {
    if (Math.pow(bubble.x - bubbleBomb.x, 2) + Math.pow(bubble.y - bubbleBomb.y, 2) <= Math.pow(bubbleBomb.scale*bubbleBomb.radius, 2)) {
      updateScore(bubble);
      bubble.popped = true;
      var pop = new Audio("Punch_HD-Mark_DiAngelo-1718986183.mp3");
      pop.volume = 10*bubble.getArea();
      pop.play();

      popped++;
    }
  }
}

/* Checks to see if Flatz has collided with the bomb */
function handleBubbleBombCollision() {
  // Checks to see if Flatz has collided with the bomb
  if (!bubbleBomb.exploding && Math.abs(bubbleBomb.x - flatz.x) <= bubbleBomb.scale*bubbleBomb.radius + 0.05 && Math.abs(bubbleBomb.y - flatz.y) <= bubbleBomb.scale*bubbleBomb.radius + 0.016) {
    // Mark the bomb as exploding
    bubbleBomb.exploding = true;
    new Audio("Beep 2-SoundBible.com-1798581971.mp3").play();
  }
}

function handleDangerBlockCollision(dangerBlock) {
  if (Math.abs(dangerBlock.x - flatz.x) < .125 && Math.abs(dangerBlock.y - flatz.y) < .225) {
    gameOver = true;
    playing = false;
  }
}

/* Updates the score with the area of the passed bubble */
function updateScore(bubble) {
  // Add the value of the popped bubble to the score
  score += (scoreMultiplier*1000*bubble.getArea());
  // Update the HTML
  scoreText.innerHTML = "Score: " + Math.floor(score);
  if (score > highScore) {
    highScore = score;
    highText.innerHTML = "High: " + Math.floor(highScore);
  }
}

/* Initializes flatz object */
function initFlatz() {
  flatz = {
    theta : 0.0,
    x : 0,
    y : 0,
    body : getFlatzBodyVertices(),
    legs : getFlatzlegVertices(),
    foot : getFlatzFootVertices()
  }
}

/* Generates a bubble of random size */
function generateBubble(r) {
  var v = [];
  var n = 16;
  var step = 2*Math.PI/n;
  // Generate 18 vertices to form the bubble
  for (var i = 0; i < n; i++) {
    v.push(vec2(r*Math.cos(i*step), r*Math.sin(i*step)));
  }

  // Create the bubble object
  var bubble = {
    vertices: v,
    radius: r,
    x: (Math.random() > .5) ? -1*Math.random() : Math.random(),
    y: -1.25,
    step: r/10,
    popped: false,
    framesTillGone: 50,
    blueValue: Math.random()*0.5 + 0.5,
    greenValue: Math.random()
  };

  // Get area function used for calculating the value of a popped bubble
  bubble.getArea = function () {
    return 2*Math.PI*Math.pow(this.radius, 2);
  }

  // Add the bubble to the list of bubbles
  bubbles.push(bubble);
}

/* Generates a bubble bomb */
function generateBubbleBomb() {
  var v = [];
  var n = 64;
  var r = 0.05;
  var step = 2*Math.PI/n;
  // Create 64 vertices for bubble bomb
  for (var i = 0; i < n; i++) {
    v.push(vec2(r*Math.cos(i*step), r*Math.sin(i*step)));
  }

  // Init bubbleBomb
  bubbleBomb = {
    vertices: v,
    radius: r,
    scale: 1,
    x: (Math.random() > .5) ? -1*Math.random() : Math.random(),
    y: 1.25,
    step: 0.1,
    exploding: false
  };
}

/* generates a danger block and adds it to the list of danger blocks */
function generateDangerBlock() {
  var v = [];
  v.push(vec2(0.1, 0.2));
  v.push(vec2(-0.1, 0.2));
  v.push(vec2(-0.1,-0.2));
  v.push(vec2(0.1,-0.2));

  // To determine which side the block comes from.
  var direction = (Math.random() > .5) ? -1 : 1;
  dangerBlock = {
    vertices: v,
    x: direction*1.25,
    y: (Math.random() > .5) ? -1*Math.random() : Math.random(),
    step: direction*0.015
  };

  dangerBlocks.push(dangerBlock);
}

/* updates bubble position and removes it if necessary */
function updateBubble(bubble, bubbleIndex) {
  // If the bubble has reached the top of the screen remove it
  if (bubble.y > 1.25) {
    bubbles.splice(bubbleIndex, 1);
    return;
  }

  // Increase it's y position
  bubble.y += bubble.step;
  if (bubble.popped) {
    bubble.framesTillGone--;
  }
  // Remove the bubble after all its popped frames are gone
  if (bubble.framesTillGone <= 0) {
    bubbles.splice(bubbleIndex, 1);
  }
}

/* updates bubble bomb position and removes it if necessary */
function updateBubbleBomb() {
  bubbleBomb.y -= bubbleBomb.step/10;
  // If it's exploding then scale for shockwave
  if (bubbleBomb.exploding) {
    bubbleBomb.scale += 10*bubbleBomb.step;
  }

  // If the bomb has reached it's peak blast size or it's below the window then remove it.
  if (bubbleBomb.radius*bubbleBomb.scale >= 4 || (!bubbleBomb.exploding && bubbleBomb.y <= -1.25)) {
    bubbleBomb = null;
  }
}

/* updates danger block and removes it if necessary */
function updateDangerBlock(dangerBlock, dangerBlockIndex) {
  // If the bubble has reached the top of the screen remove it
  if (dangerBlock.x > 1.25 || dangerBlock.x < -1.25) {
    dangerBlocks.splice(dangerBlockIndex, 1);
    return;
  }

  // Increase its y position
  dangerBlock.x += (dangerBlock.direction === -1) ? dangerBlock.step : -dangerBlock.step;
}

/* Draws Flatz */
function drawFlatz() {

  // Transformation matrix for Flatz rotation and translation
  var matrix = [Math.cos(flatz.theta), -Math.sin(flatz.theta), 0.0,Math.sin(flatz.theta), Math.cos(flatz.theta), 0.0,flatz.x, flatz.y, 0.0];
  var matrixLoc = gl.getUniformLocation(shaderProgram, "M");
  gl.uniformMatrix3fv(matrixLoc, false, matrix);

  // color for body and legs
  var color = gl.getUniformLocation(shaderProgram, "color");
  gl.uniform4f(color, 0.0, 0.9, 0.9, 1.0);

  // Buffer the body vertices and draw
  gl.bufferData(gl.ARRAY_BUFFER, flatten(flatz.body), gl.STATIC_DRAW);
  gl.drawArrays( gl.TRIANGLE_FAN, 0, flatz.body.length);

  // Buffer leg vertices and draw
  gl.lineWidth(4);
  gl.bufferData(gl.ARRAY_BUFFER, flatten(flatz.legs), gl.STATIC_DRAW);
  gl.drawArrays( gl.LINES, 0, flatz.legs.length);

  // Set feet color to white
  gl.uniform4f(color, 0.9, 0.9, 0.9, 1.0);

  // Buffer feet vertices and draw
  gl.bufferData(gl.ARRAY_BUFFER, flatten(flatz.foot), gl.STATIC_DRAW);
  gl.drawArrays( gl.TRIANGLE_FAN, 0, flatz.foot.length);
}

/* Draws the passed bubble and removes if if it's popped*/
function drawBubble(bubble) {

  // Translation matrix for the bubble
  var matrix = [1.0, 0.0, 0.0, 0.0, 1.0, 0.0, bubble.x, bubble.y, 1.0];
  var matrixLoc = gl.getUniformLocation(shaderProgram, "M");
  gl.uniformMatrix3fv(matrixLoc, false, matrix);

  // Set bubble color
  var color = gl.getUniformLocation(shaderProgram, "color");
  gl.uniform4f(color, 0.0, bubble.greenValue, bubble.blueValue, 1.0);

  // Buffer bubble vertices
  gl.bufferData(gl.ARRAY_BUFFER, flatten(bubble.vertices), gl.STATIC_DRAW);

  // If the bubble is popped draw a popped bubble for the remainer of its frames
  if (bubble.popped) {
    gl.lineWidth(2);
    // Draw using lines to get popped look
    gl.drawArrays( gl.LINES, 0, bubble.vertices.length);
  } else {
    // If it's not popped draw the filled circle
    gl.drawArrays( gl.TRIANGLE_FAN, 0, bubble.vertices.length);
  }
}

/* Draws the bubble bomb */
function drawBubbleBomb() {

  // Set the bomb color to yellow
  var color = gl.getUniformLocation(shaderProgram, "color");
  gl.uniform4f(color, 1.0, 1.0, 0.0, 1.0);

  // Translation and scale matrix for the bubble bomb
  var matrix = [bubbleBomb.scale, 0.0, 0.0, 0.0, bubbleBomb.scale, 0.0, bubbleBomb.x, bubbleBomb.y, 1.0];
  var matrixLoc = gl.getUniformLocation(shaderProgram, "M");
  gl.uniformMatrix3fv(matrixLoc, false, matrix);

  // Buffer the bomb vertices
  gl.bufferData(gl.ARRAY_BUFFER, flatten(bubbleBomb.vertices), gl.STATIC_DRAW);

  // Draw the bomb vertices
  gl.lineWidth(2);
  gl.drawArrays(gl.LINE_LOOP, 0, bubbleBomb.vertices.length);
}

/* Draws a danger block */
function drawDangerBlock(dangerBlock) {

  // Translation matrix for the bubble
  var matrix = [1.0, 0.0, 0.0, 0.0, 1.0, 0.0, dangerBlock.x, dangerBlock.y, 1.0];
  var matrixLoc = gl.getUniformLocation(shaderProgram, "M");
  gl.uniformMatrix3fv(matrixLoc, false, matrix);

  // Set bubble color
  var color = gl.getUniformLocation(shaderProgram, "color");
  gl.uniform4f(color, 0.0, 0.0, 0.0, 1.0);

  gl.lineWidth(4);
  // Buffer dangerBlock vertices and draw
  gl.bufferData(gl.ARRAY_BUFFER, flatten(dangerBlock.vertices), gl.STATIC_DRAW);
  gl.drawArrays( gl.LINE_LOOP, 0, dangerBlock.vertices.length);
}

function drawX() {
  var matrix = [1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0];
  var matrixLoc = gl.getUniformLocation(shaderProgram, "M");
  gl.uniformMatrix3fv(matrixLoc, false, matrix);
  var color = gl.getUniformLocation(shaderProgram, "color");
  gl.uniform4f(color, 1.0, 0.0, 0.0, 1.0);
  gl.lineWidth(10);
  gl.bufferData(gl.ARRAY_BUFFER, flatten([vec2(1.0, 1.0), vec2(-1.0, -1.0)]), gl.STATIC_DRAW);
  gl.drawArrays(gl.LINES, 0, 2);
  gl.bufferData(gl.ARRAY_BUFFER, flatten([vec2(-1.0, 1.0), vec2(1.0, -1.0)]), gl.STATIC_DRAW);
  gl.drawArrays(gl.LINES, 0, 2);
}

/* Changes position and rotation of Flatz based on the state of key presses */
function updateKeyInfo() {

  // Change pos and set rotation
  if (keyMapping[38] || keyMapping[87]) {
    flatz.theta = 0;
    if (flatz.y < 1)
      flatz.y += 0.015;
  }
  if (keyMapping[40] || keyMapping[83]) {
    flatz.theta = Math.PI;
    if (flatz.y > -1)
      flatz.y -= 0.015;
  }
  if (keyMapping[39] || keyMapping[68]) {
    flatz.theta = Math.PI/2;
    if (flatz.x < 1)
      flatz.x += 0.015;
  }
  if (keyMapping[37] || keyMapping[65]) {
    flatz.theta = -Math.PI/2;
    if (flatz.x > -1)
      flatz.x -= 0.015;
  }

  // Angles for multiple key presses
  if ((keyMapping[38] || keyMapping[87]) && (keyMapping[39] || keyMapping[68]))
    flatz.theta = Math.PI/4;
  if ((keyMapping[38] || keyMapping[87]) && (keyMapping[37] || keyMapping[65]))
    flatz.theta = -Math.PI/4;
  if ((keyMapping[40] || keyMapping[83]) && (keyMapping[39] || keyMapping[68]))
    flatz.theta = 3*Math.PI/4;
  if ((keyMapping[40] || keyMapping[83]) && (keyMapping[37] || keyMapping[65]))
    flatz.theta = -3*Math.PI/4;
}

/* Flags keys for press state */
function keyDown(event) {
  var key = event.keyCode;
  if (key === 38 || key === 39 || key === 40 || key === 37 ||
      key === 87 || key === 83 || key === 65 || key === 68)
    keyMapping[key] = true;
}

/* Flags keys for press state */
function keyUp(event) {
  var key = event.keyCode;
  if (key === 38 || key === 39 || key === 40 || key === 37 ||
      key === 87 || key === 83 || key === 65 || key === 68)
      keyMapping[key] = false;
}

/* Returns an array of vertices for Flatz body */
function getFlatzBodyVertices() {
  var vertices = [];
  vertices.push(vec2(0.05, -0.016));
  vertices.push(vec2(0.05, 0.016));
  vertices.push(vec2(-0.05, 0.016));
  vertices.push(vec2(-0.05, -0.016));
  return vertices;
}

/* Returns am array of vertices for Flatz legs */
function getFlatzlegVertices() {
  var vertices = [];
  vertices.push(vec2(0.025, -0.04));
  vertices.push(vec2(0.025, -0.016));
  vertices.push(vec2(-0.025, -0.016));
  vertices.push(vec2(-0.025, -0.04));
  return vertices;
}

/* Returns an array of vertices for Flatz feet */
function getFlatzFootVertices() {
  var vertices = [];
  vertices.push(vec2(0.05, -0.04));
  vertices.push(vec2(0.05, -0.056));
  vertices.push(vec2(-0.05, -0.04));
  vertices.push(vec2(-0.05, -0.056));
  return vertices;
}

/* Initializes array buffer */
function initBuffer() {
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
}

/* Returns a callback function to get the remaining time since being called with time in ms. */
function timer(time) {
  var start = Date.now();
  return function() {
      return time - (Date.now() - start);
  }
}

/* Updates HTML with time id and changes game state if there is no time remaining */
function checkGameTime() {
  var timeLeft = timeRemaining();
  scoreMultiplier = 1 + Math.floor(time/1000 - timeLeft/1000);
  timeText.innerHTML = "Time: " + timeLeft/1000;
  if (timeLeft <= 0) {
    timeText.innerHTML = "Time: " + 0;
    resetGlobals();
    playing = false;
  }
}
