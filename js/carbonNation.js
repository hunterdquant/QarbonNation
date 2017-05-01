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

// For 9 features: 1,200,000,000 states
// For 8 degree version: 5,000,000 states.
// For 4 degree version with restricted movement: 64,000 states.


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
var trainText;
var episodeText;
var poppedText;
// Current score
var score;
// The base time value
var train;

var highScore;
// The number of popped bubbles
var popped;

// Game music
var song;

// Index is the action taken.
// Linear search through action rather than all state.
var qvals = [[],[],[],[],[],[],[],[]];
var actionCount = 8;
var qval = {
  state: null,
  action: null,
  val: null
};

var state = {
  nearestBubbleBombDegree: null,
  nearestBubbleDegree: null,
  nearestWallDegree: null,
  nearestSide: null,
  bubbleDensity: null
};

// var state = {
//   nearestBubbleBombX: null,
//   nearestBubbleBombY: null,
//   nearestBubbleX: null,
//   nearestBubbleY: null,
//   nearestWallX: null,
//   nearestWallX: null,
//   nearestSide: null,
//   bubbleDensity: null,
//   wallDensity: null
// };

var bubbleRadius = 0.2;
var wallRadius = 0.4;

var iterationPerEpisode = 3600;
var trainingIteration = 0;
var episode = 1;

// Too lazy to lookup js enums.
var N = 0;
var NE = 1;
var S = 2;
var SE = 3;
var E = 4;
var NW = 5;
var W = 6;
var SW = 7;
var WAIT = 8;

var learningRate = 0.1;
var discountFactor = 0.5;

var fweights = [0.0, 0.0, 0.0, 0.0, 0.0];

var exploreProb = 0.5;

/* Initializes WebGL and globals */
function init() {

  // Get reference to html elements
  scoreText = document.getElementById("score");
  trainText = document.getElementById("train");
  episodeText = document.getElementById("episode");
  poppedText = document.getElementById("pop");
  // Set initial score and time values
  score = 0;

  popped = 0;

  // Init webgl and specify clipspace.
  var canvas = document.getElementById("gl-canvas");
  gl = WebGLUtils.setupWebGL(canvas);
  if (!gl) {alert("Web gl is not available");}

  // Set clip space and background color
  gl.viewport(0, 0, 512, 512);
  gl.clearColor(0.9, 0.3, 0.3, 1.0);

  // Set initial play state
  playing = false;

  song = new Audio("audio/VoiceOverUnder.mp3");

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
  if (trainingIteration < iterationPerEpisode) {

    // Get random radius with min size
    var radius = Math.random() + 0.05;

    // If the radius is small enough generate a bubble
    if (radius < 0.25)
      generateBubble(.1);
    // If the generated radiues is very small and there is not currently a bomb, generate a bomb.
    if (radius < 0.0515 && bubbleBomb === null)
      generateBubbleBomb();
    if (radius < 0.06) {
      generateDangerBlock();
    }
    qlearn();
    // Draw the character
    drawFlatz();
    uiUpdate();
    poppedText.innerHTML = "Popped: " + popped;
    trainingIteration++;
  } else {
    episode++;
    if (episode%10 == 0) {
      exploreProb /= 2;
    }
    startNew();
  }
  // Update frame
  requestAnimFrame(gameLoop);
}

function uiUpdate() {
  scoreText.innerHTML = "Score: " + score;
  trainText.innerHTML = "Iter: " + trainingIteration;
  episodeText.innerHTML = "Episode: " + episode;
  poppedText.innerHTML = "Popped: " + popped;
}

/* Resets game upon the press of a button */
function startNew() {
  resetGlobals();
  scoreText.innerHTML = "Score: 0";
  trainText.innerHTML = "Iter: 0";
  song.currentTime = 0;
  song.play();
}

function qlearn() {
  var bub = getNearestBubble();
  var wall = getNearestWall();
  var state = {
    nearestBubbleBombDegree: fNearestBubbleBombDegree(),
    nearestBubbleDegree: fNearestBubbleDegree(bub),
    nearestWallDegree: fNearestWallDegree(wall),
    nearestSide: fNearestSide(),
    bubbleDensity: fBubbleDensity()
  };

  var choice = chooseAction(state);
  if (choice.state === null) {
    choice.state = state;
    qvals[choice.action].push(choice);
  }
  var reward = takeAction(choice.state, choice.action);
  var val = 0;
  val += fweights[0]*choice.state.nearestBubbleBombDegree;
  val += fweights[1]*choice.state.nearestBubbleDegree;
  val += fweights[2]*choice.state.nearestWallDegree;
  val += fweights[3]*choice.state.nearestSide;
  val += fweights[4]*choice.state.bubbleDensity;
  choice.val = val;

  bub = getNearestBubble();
  wall = getNearestWall();
  var newState = {
    nearestBubbleBombDegree: fNearestBubbleBombDegree(),
    nearestBubbleDegree: fNearestBubbleDegree(bub),
    nearestWallDegree: fNearestWallDegree(wall),
    nearestSide: fNearestSide(),
    bubbleDensity: fBubbleDensity()
  };

  var correction = getCorrection(newState, reward, val);
  fweights[0] = fweights[0] + learningRate*correction*newState.nearestBubbleBombDegree;
  fweights[1] = fweights[1] + learningRate*correction*newState.nearestBubbleDegree;
  fweights[2] = fweights[2] + learningRate*correction*newState.nearestWallDegree;
  fweights[3] = fweights[3] + learningRate*correction*newState.nearestSide;
  fweights[4] = fweights[4] + learningRate*correction*newState.bubbleDensity;
}

function getCorrection(state, reward, val) {
  var qmax = null;
  var qval = null;
  for (var i = 0; i < actionCount; i++) {
    tmpq = findQ(state, i);
    if ((tmpq !== null && tmpq.val >= qmax) || tmpq !== null && qmax === null) {
      qval = tmpq;
      qmax = qval.val;
    }
  }
  if (qval !== null && qval.val !== null) {
    return reward + discountFactor*qval.val - val;
  }
  return reward - val;
}

function chooseAction(state) {
  var qval = null;
  var rand = Math.random();
  if (rand < exploreProb) {
    var a = getRandomAction();
    var tmpq = findQ(state, a);
    if (tmpq !== null) {
      return tmpq;
    }
    return {
      state: null,
      action: a,
      val: 0
    };
  } else {
    var qmax = null;
    for (var i = 0; i < actionCount; i++) {
      var tmpq = findQ(state, i);
      if ((tmpq !== null && tmpq.val >= qmax) || (tmpq !== null && qmax === null)) {
        qval = tmpq;
        qmax = qval.val;
      }
    }
    if (qval !== null) {
      return qval;
    }
  }
  var a = getRandomAction();
  var tmpq = findQ(state, a);
  if (tmpq !== null) {
    return tmpq;
  }
  return {
    state: null,
    action: a,
    val: 0
  };
}

function getRandomAction() {
  return Math.floor(Math.random()*actionCount);
}

function setExploreProb() {
  var tmp = document.getElementById("exploreProb");
  exploreProb = parseFloat(tmp.value);
}

function takeAction(state, action) {
    var reward = 0;
    // Update displacement values based on key mappings
    updateKeyInfo(action);
    // Handle collision, draw, and update each bubble
    for (var i = bubbles.length - 1; i >= 0; i--) {
      reward += handleBubbleCollision(bubbles[i]);
      drawBubble(bubbles[i]);
      updateBubble(bubbles[i], i);
    }

    // If the bomb exists handle its collision and draw it
    if (bubbleBomb !== null) {
      reward += handleBubbleBombCollision();
      drawBubbleBomb();
      updateBubbleBomb();
    }
    // Handle collision, draw, and update each danger block
    for (i = dangerBlocks.length - 1; i >= 0; i--) {
      reward += handleDangerBlockCollision(dangerBlocks[i]);
      drawDangerBlock(dangerBlocks[i], i);
      updateDangerBlock(dangerBlocks[i], i);
    }
    return reward;
}

function findQ(state, action) {
  for (var i = 0; i < qvals[action].length; i++) {
    if (qvals[action][i].state.nearestBubbleBombDegree !== state.nearestBubbleBombDegree) continue;
    if (qvals[action][i].state.nearestBubbleDegree !== state.nearestBubbleDegree) continue;
    if (qvals[action][i].state.nearestWallDegree !== state.nearestWallDegree) continue;
    if (qvals[action][i].state.nearestSide !== state.nearestSide) continue;
    if (qvals[action][i].state.bubbleDensity !== state.bubbleDensity) continue;
    return qvals[action][i];
  }
  return null;
}

/* resets globals on lose and game start */
function resetGlobals() {
  // Reset all globals
  score = 0;
  trainingIteration = 0;
  popped = 0;
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
    var pop = new Audio("audio/Punch_HD-Mark_DiAngelo-1718986183.mp3");
    pop.volume = 10*bubble.getArea();
    pop.play();
    popped++;
    return 0.5;
  }

  // Check if the bubble is in the blast radius of the bomb if one is exploding
  if (bubbleBomb !== null && bubbleBomb.exploding && !bubble.popped) {
    if (Math.pow(bubble.x - bubbleBomb.x, 2) + Math.pow(bubble.y - bubbleBomb.y, 2) <= Math.pow(bubbleBomb.scale*bubbleBomb.radius, 2)) {
      updateScore(bubble);
      bubble.popped = true;
      var pop = new Audio("audio/Punch_HD-Mark_DiAngelo-1718986183.mp3");
      pop.volume = 10*bubble.getArea();
      pop.play();
      popped++;
      return 0.5;
    }
  }
  return 0;
}

/* Checks to see if Flatz has collided with the bomb */
function handleBubbleBombCollision() {
  // Checks to see if Flatz has collided with the bomb
  if (!bubbleBomb.exploding && Math.abs(bubbleBomb.x - flatz.x) <= bubbleBomb.scale*bubbleBomb.radius + 0.05 && Math.abs(bubbleBomb.y - flatz.y) <= bubbleBomb.scale*bubbleBomb.radius + 0.016) {
    // Mark the bomb as exploding
    bubbleBomb.exploding = true;
    new Audio("audio/Beep 2-SoundBible.com-1798581971.mp3").play();
    return 10;
  }
  return 0;
}

function handleDangerBlockCollision(dangerBlock) {
  if (Math.abs(dangerBlock.x - flatz.x) < .125 && Math.abs(dangerBlock.y - flatz.y) < .225) {
    score -= 1000;
    dangerBlock.hit = true;
    return -10;
  }
  return 0;
}


/* Updates the score with the area of the passed bubble */
function updateScore(bubble) {
  // Add the value of the popped bubble to the score
  score += Math.trunc(1000*bubble.getArea());
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
    step: direction*0.015,
    hit: false
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

  if (dangerBlock.hit) {
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
function updateKeyInfo(action) {

  // Change pos and set rotation
  if (keyMapping[38] || keyMapping[87] || action == N || action == NE || action == NW) {
    flatz.theta = 0;
    if (flatz.y < 1)
      flatz.y += 0.015;
  } else if (keyMapping[40] || keyMapping[83] || action == S || action == SE || action == SW) {
    flatz.theta = Math.PI;
    if (flatz.y > -1)
      flatz.y -= 0.015;
  }
  if (keyMapping[39] || keyMapping[68] || action == E || action == NE || action == SE) {
    flatz.theta = Math.PI/2;
    if (flatz.x < 1)
      flatz.x += 0.015;
  } else if (keyMapping[37] || keyMapping[65] || action == W || action == NW || action == SW) {
    flatz.theta = -Math.PI/2;
    if (flatz.x > -1)
      flatz.x -= 0.015;
  }

  // Angles for multiple key presses
  if ((keyMapping[38] || keyMapping[87]) && (keyMapping[39] || keyMapping[68]) || action == NE)
    flatz.theta = Math.PI/4;
  if ((keyMapping[38] || keyMapping[87]) && (keyMapping[37] || keyMapping[65]) || action == NW)
    flatz.theta = -Math.PI/4;
  if ((keyMapping[40] || keyMapping[83]) && (keyMapping[39] || keyMapping[68]) || action == SE)
    flatz.theta = 3*Math.PI/4;
  if ((keyMapping[40] || keyMapping[83]) && (keyMapping[37] || keyMapping[65]) || action == SW)
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
  var timeLeft = timeRemaining;
  timeText.innerHTML = "Time: " + timeLeft/1000;
  if (timeLeft <= 0) {
    timeText.innerHTML = "Time: " + 0;
    resetGlobals();
    playing = false;
  }
}

function getNearestBubble() {
    var nearestBubbleDist = null;
    var nearestBubble = null;
    for (i = bubbles.length - 1; i >= 0; i--) {
      var n = normSquared(flatz.x, bubbles[i].x, flatz.y, bubbles[i].y);
      if (nearestBubbleDist === null ||  n < nearestBubbleDist) {
        nearestBubbleDist = n;
        nearestBubble = bubbles[i];
      }
    }
    return nearestBubble;
}

function clamp(x, min, max) {
  return (x - min)/(max - min);
}

// function fNearestBubbleX(bubble) {
//   return (bubble !== null && bubble !== undefined) ? Math.round(100*clamp(flatz.x-bubble.x, -2, 2))/100 : 1;
// }

// function fNearestBubbleY(bubble) {
//   return (bubble !== null && bubble !== undefined) ? Math.round(100*clamp(flatz.y-bubble.y, -2, 2))/100 : 1;
// }

// function fNearestWallX(wall) {
//   return (wall !== null && wall !== undefined) ? Math.round(100*clamp(flatz.x-wall.x, -2, 2))/100 : 1;
// }

// function fNearestWallY(wall) {
//   return (wall !== null && wall !== undefined) ? Math.round(100*clamp(flatz.y-wall.y, -2, 2))/100 : 1;
// }

function bubbleInRadius(bubble) {
  // Checks to see if Flatz has collided with the bomb
  if (!bubble.popped && Math.abs(bubble.x - flatz.x) <= bubble.radius + bubbleRadius + 0.05 && Math.abs(bubble.y - flatz.y) <= bubble.radius + bubbleRadius + 0.016) {
    return true;
  }
  return false;
}

function getNearestWall() {
    var nearestWallDist = null;
    var nearestWall = null;
    for (i = dangerBlocks.length - 1; i >= 0; i--) {
      var n = normSquared(flatz.x, dangerBlocks[i].x, flatz.y, dangerBlocks[i].y);
      if (nearestWallDist === null || n < nearestWallDist) {
        nearestWallDist = n;
        nearestWall = dangerBlocks[i];
      }
    }
    return nearestWall;
}

function normSquared(x1, x2, y1, y2) {
  return Math.abs(Math.exp(x1 - x2, 2) + Math.exp(y1 - y2, 2));
}

function dangerBlockInRadius(dangerBlock) {
  if (Math.abs(dangerBlock.x - flatz.x) < wallRadius + .125 && Math.abs(dangerBlock.y +  - flatz.y) < wallRadius + .225) {
    return true;
  }
  return false;
}

function fNearestBubbleBombDegree(bomb) {
  if (bomb === null || bomb === undefined) {
    return -1;
  }
  // U, ul, l, ld, d, rd, r, ur
  // 0.0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875

  var dX = (flatz.x - bomb.x), dY = (flatz.y - bomb.y);
  var angle = (360 + ((180/Math.PI)*(Math.atan2(dY,dX)))) % 360;
  var min = Math.min(Math.abs(angle), Math.abs(angle-90), Math.abs(angle-180), Math.abs(angle-270));
  if (Math.abs(angle) === min) {
    return 0;
  } else if (Math.abs(angle-45) === min) {
    return 0.125;
  } else if (Math.abs(angle-90) === min) {
    return 0.25;
  } else if (Math.abs(angle-135) === min) {
    return 0.375;
  } else if (Math.abs(angle-180) === min) {
    return 0.5;
  } else if (Math.abs(angle-225) === min) {
    return 0.625;
  } else if (Math.abs(angle-270) === min) {
    return 0.75;
  } else if (Math.abs(angle-315) === min) {
    return 0.875;
  }
  return -1;
}

function fNearestBubbleDegree(bubble) {
  if (bubble === null || bubble === undefined) {
    return -1;
  }
  // Up, left, down, right
  // 0.0, 0.25, 0.5, 0.75
  var dX = (flatz.x - bubble.x), dY = (flatz.y - bubble.y);
  var angle = (360 + ((180/Math.PI)*(Math.atan2(dY,dX)))) % 360;
  var min = Math.min(Math.abs(angle), Math.abs(angle-90), Math.abs(angle-180), Math.abs(angle-270));
  if (Math.abs(angle) === min) {
    return 0;
  } else if (Math.abs(angle-45) === min) {
    return 0.125;
  } else if (Math.abs(angle-90) === min) {
    return 0.25;
  } else if (Math.abs(angle-135) === min) {
    return 0.375;
  } else if (Math.abs(angle-180) === min) {
    return 0.5;
  } else if (Math.abs(angle-225) === min) {
    return 0.625;
  } else if (Math.abs(angle-270) === min) {
    return 0.75;
  } else if (Math.abs(angle-315) === min) {
    return 0.875;
  }
  return -1;
}

function fNearestWallDegree(wall) {
  if (wall === null) {
    return -1;
  }
  // Up, left, down, right
  // 0.0, 0.25, 0.5, 0.75

  var dX = (flatz.x - wall.x), dY = (flatz.y - wall.y);
  var angle = (360 + ((180/Math.PI)*(Math.atan2(dY,dX)))) % 360;
  var min = Math.min(Math.abs(angle), Math.abs(angle-90), Math.abs(angle-180), Math.abs(angle-270));
  if (Math.abs(angle) === min) {
    return 0;
  } else if (Math.abs(angle-45) === min) {
    return 0.125;
  } else if (Math.abs(angle-90) === min) {
    return 0.25;
  } else if (Math.abs(angle-135) === min) {
    return 0.375;
  } else if (Math.abs(angle-180) === min) {
    return 0.5;
  } else if (Math.abs(angle-225) === min) {
    return 0.625;
  } else if (Math.abs(angle-270) === min) {
    return 0.75;
  } else if (Math.abs(angle-315) === min) {
    return 0.875;
  }
  return -1;
}

// function fNearestBubbleBombX() {
//     return (bubbleBomb !== null) ? Math.round(100*clamp(flatz.x-bubbleBomb.x, -2, 2))/100 : 1;
// }

// function fNearestBubbleBombY() {
//     return (bubbleBomb !== null) ? Math.round(100*clamp(flatz.y-bubbleBomb.y, -2, 2))/100 : 1;
// }

function fBubbleDensity() {
    var bubbleCount = 0;
    for (var i = bubbles.length - 1; i >= 0; i--) {
      if (bubbleInRadius(bubbles[i])) {
        bubbleCount++;
      }
    }
    // Limit and Normalize data
    if (bubbleCount > 10) {
      bubbleCount = 10;
    }
    return clamp(bubbleCount, 0, 10);
}

function fWallDensity() {
    var wallCount = 0;
    for (i = dangerBlocks.length - 1; i >= 0; i--) {
      if (dangerBlockInRadius(dangerBlocks[i])) {
        wallCount++;
      }
    }
    // Limit and Normalize data
    if (wallCount > 10) {
      wallCount = 10;
    }
    return clamp(wallCount, 0, 10);
}

function fNearestSide() {
  // X distance from each side (-1 and 1)
  return Math.round(100*clamp(Math.min(Math.abs(flatz.x + 1), Math.abs(flatz.x - 1)), 0, 2))/100;
}