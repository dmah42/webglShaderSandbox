function loadFile(url, data, callback, errorCallback) {
  var request = new XMLHttpRequest();
  request.open('GET', url, true);
  request.onreadystatechange = function () {
    // If the request is "DONE" (completed or failed)
    if (request.readyState == 4) {
      if (request.status == 200)
        callback(request.responseText, data);
      else
        errorCallback(url);
    }
  };

  request.send(null);
}

function loadFiles(urls, callback, errorCallback) {
  var numUrls = urls.length;
  var numComplete = 0;
  var result = [];

  function perFileCallback(text, urlIndex) {
    result[urlIndex] = text;

    if (++numComplete == numUrls)
      callback(result);
  }

  for (var i = 0; i < numUrls; ++i)
    loadFile(urls[i], i, perFileCallback, errorCallback);
}

var gl;

function initGL(canvas) {
  try {
    gl = canvas.getContext('experimental-webgl');
    gl.viewportWidth = canvas.width;
    gl.viewportHeight = canvas.height;
  } catch (e) {
  }
  if (!gl)
    alert("Failed to initialize WebGL");
}

var currentProgram;
var shaderPrograms = [];

function compileShaders(programID) {
  console.log('Compiling: ' + programID);
  compileShader = function(shaderType, shaderSource) {
    var shader = gl.createShader(shaderType);
    gl.shaderSource(shader, shaderSource);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
      shader = null;
    }
    return shader;
  };

  linkProgram = function(programID, vertexShader, fragmentShader) {
    var program = gl.createProgram();
    program.displayName = programID;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      alert('Failed to link program: ' + programID);

    return program;
  };

  bindProgram = function(program) {
    program.vertexPositionAttribute = gl.getAttribLocation(program, 'aVertexPosition');
    gl.enableVertexAttribArray(program.vertexPositionAttribute);

    program.vertexNormalAttribute = gl.getAttribLocation(program, 'aVertexNormal');
    gl.enableVertexAttribArray(program.vertexNormalAttribute);

    program.textureCoordAttribute = gl.getAttribLocation(program, 'aTextureCoord');
    gl.enableVertexAttribArray(program.textureCoordAttribute);

    program.pMatrixUniform = gl.getUniformLocation(program, 'uPMatrix');
    program.mvMatrixUniform = gl.getUniformLocation(program, 'uMVMatrix');
    program.nMatrixUniform = gl.getUniformLocation(program, 'uNMatrix');
    program.samplerUniform = gl.getUniformLocation(program, 'uSampler');
    program.ambientColorUniform = gl.getUniformLocation(program, 'uAmbientColor');
    program.shininessUniform = gl.getUniformLocation(program, 'uShininess');
    program.pointLightingLocationUniform = gl.getUniformLocation(program, 'uPointLightingLocation');
    program.pointLightingColorUniform = gl.getUniformLocation(program, 'uPointLightingColor');
  };

  loadFiles(['shaders/' + programID + '.vshader', 'shaders/' + programID + '.fshader'],
      function (shaderSource) {
        var vertexShader = compileShader(gl.VERTEX_SHADER, shaderSource[0]);
        var fragmentShader = compileShader(gl.FRAGMENT_SHADER, shaderSource[1]);
        var program = linkProgram(programID, vertexShader, fragmentShader);
        bindProgram(program);
              
        if (shaderPrograms[programID] !== undefined)
          console.warning('Overriding shader program: ' + programID);
        shaderPrograms[programID] = program;
      },
      function (url) {
        alert('Failed to load ' + url);
      }
  );
}

// TODO: load on demand
function initShaders() {
  var shader_options = document.getElementById('shader-select').options;
  for (var i = 0; i < shader_options.length; ++i)
    compileShaders(shader_options[i].value);
}

function handleLoadedTexture(texture) {
  console.log('loaded texture');
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.image);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
  gl.generateMipmap(gl.TEXTURE_2D);

  gl.bindTexture(gl.TEXTURE_2D, null);
}

var gridTexture;

function initTexture() {
  gridTexture = gl.createTexture();
  gridTexture.displayName = 'gridTexture';
  gridTexture.image = new Image();
  gridTexture.image.onload = function () {
    handleLoadedTexture(gridTexture);
  };

  gridTexture.image.src = 'grid.png';
}

var mvMatrix = mat4.create();
var mvMatrixStack = [];
var pMatrix = mat4.create();

function mvPushMatrix() {
  var copy = mat4.create();
  mat4.set(mvMatrix, copy);
  mvMatrixStack.push(copy);
}

function mvPopMatrix() {
  if (mvMatrixStack.length === 0)
    throw "Invalid popMatrix";
  mvMatrix = mvMatrixStack.pop();
}

function setMatrixUniforms() {
  gl.uniformMatrix4fv(currentProgram.pMatrixUniform, false, pMatrix);
  gl.uniformMatrix4fv(currentProgram.mvMatrixUniform, false, mvMatrix);

  if (currentProgram.nMatrixUniform) {
    var normalMatrix = mat3.create();
    mat4.toInverseMat3(mvMatrix, normalMatrix);
    mat3.transpose(normalMatrix);
    gl.uniformMatrix3fv(currentProgram.nMatrixUniform, false, normalMatrix);
  }
}

function degToRad(degrees) {
  return degrees * Math.PI / 180;
}

var mouseDown = false;
var lastMouseX = null;
var lastMouseY = null;

var rotationMatrix = mat4.create();
mat4.identity(rotationMatrix);

function handleMouseDown(event) {
  mouseDown = true;
  lastMouseX = event.clientX;
  lastMouseY = event.clientY;
}

function handleMouseUp(event) {
  mouseDown = false;
}

function handleMouseMove(event) {
  if (!mouseDown)
    return;
  var newX = event.clientX;
  var newY = event.clientY;

  var deltaX = newX - lastMouseX;
  var newRotationMatrix = mat4.create();
  mat4.identity(newRotationMatrix);
  mat4.rotate(newRotationMatrix, degToRad(deltaX / 8), [0, 1, 0]);

  var deltaY = newY - lastMouseY;
  mat4.rotate(newRotationMatrix, degToRad(deltaY / 8), [1, 0, 0]);

  mat4.multiply(newRotationMatrix, rotationMatrix, rotationMatrix);

  lastMouseX = newX;
  lastMouseY = newY;
}

object = function(name) {
  this.displayName = name;
  this.positionBuffer_ = gl.createBuffer();
  this.positionBuffer_.displayName = name + 'PositionBuffer';
  this.normalBuffer_ = gl.createBuffer();
  this.normalBuffer_.displayName = name + 'NormalBuffer';
  this.textureCoordBuffer_ = gl.createBuffer();
  this.textureCoordBuffer_.displayName = name + 'TextureCoordBuffer';
  this.indexBuffer_ = gl.createBuffer();
  this.indexBuffer_.displayName = name + 'IndexBuffer';
};

var objects = {};
var currentObject;

function initObjects() {
  initSphere = function() {
    var latitudeBands = 20;
    var longitudeBands = 20;
    var radius = 1.5;
  
    var vertexPositionData = [];
    var normalData = [];
    var textureCoordData = [];
    var indexData = [];
    for (var latNumber = 0; latNumber <= latitudeBands; ++latNumber) {
      var theta = latNumber * Math.PI / latitudeBands;
      var sinTheta = Math.sin(theta);
      var cosTheta = Math.cos(theta);
  
      for (var longNumber = 0; longNumber <= longitudeBands; ++longNumber) {
        var phi = longNumber * 2 * Math.PI / longitudeBands;
        var sinPhi = Math.sin(phi);
        var cosPhi = Math.cos(phi);
  
        var x = cosPhi * sinTheta;
        var y = cosTheta;
        var z = sinPhi * sinTheta;
        var u = 1 - (longNumber / longitudeBands);
        var v = 1 - (latNumber / latitudeBands);
  
        normalData.push(x);
        normalData.push(y);
        normalData.push(z);
        textureCoordData.push(u);
        textureCoordData.push(v);
        vertexPositionData.push(radius * x);
        vertexPositionData.push(radius * y);
        vertexPositionData.push(radius * z);
        
        if (latNumber < latitudeBands && longNumber < longitudeBands) {
          var first = (latNumber * (longitudeBands + 1)) + longNumber;
          var second = first + longitudeBands + 1;
          indexData.push(first);
          indexData.push(second);
          indexData.push(first + 1);
    
          indexData.push(second);
          indexData.push(second + 1);
          indexData.push(first + 1);
        }
      }
    }

    var sphere = new object('sphere');
  
    gl.bindBuffer(gl.ARRAY_BUFFER, sphere.normalBuffer_);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normalData), gl.STATIC_DRAW);
    sphere.normalBuffer_.itemSize = 3;
    sphere.normalBuffer_.numItems = normalData.length / 3;
  
    gl.bindBuffer(gl.ARRAY_BUFFER, sphere.textureCoordBuffer_);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoordData), gl.STATIC_DRAW);
    sphere.textureCoordBuffer_.itemSize = 2;
    sphere.textureCoordBuffer_.numItems = textureCoordData.length / 2;
  
    gl.bindBuffer(gl.ARRAY_BUFFER, sphere.positionBuffer_);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexPositionData), gl.STATIC_DRAW);
    sphere.positionBuffer_.itemSize = 3;
    sphere.positionBuffer_.numItems = vertexPositionData.length / 3;
  
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sphere.indexBuffer_);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indexData), gl.STATIC_DRAW);
    sphere.indexBuffer_.itemSize = 1;
    sphere.indexBuffer_.numItems = indexData.length;
    
    return sphere;
  };

  initCube = function() {
    vertices = [
        // Front face
        -1.0, -1.0,  1.0,
         1.0, -1.0,  1.0,
         1.0,  1.0,  1.0,
        -1.0,  1.0,  1.0,
  
        // Back face
        -1.0, -1.0, -1.0,
        -1.0,  1.0, -1.0,
         1.0,  1.0, -1.0,
         1.0, -1.0, -1.0,
  
        // Top face
        -1.0,  1.0, -1.0,
        -1.0,  1.0,  1.0,
         1.0,  1.0,  1.0,
         1.0,  1.0, -1.0,
  
        // Bottom face
        -1.0, -1.0, -1.0,
         1.0, -1.0, -1.0,
         1.0, -1.0,  1.0,
        -1.0, -1.0,  1.0,
  
        // Right face
         1.0, -1.0, -1.0,
         1.0,  1.0, -1.0,
         1.0,  1.0,  1.0,
         1.0, -1.0,  1.0,
  
        // Left face
        -1.0, -1.0, -1.0,
        -1.0, -1.0,  1.0,
        -1.0,  1.0,  1.0,
        -1.0,  1.0, -1.0
    ];
  
    var normals = [
        // Front face
         0.0,  0.0,  1.0,
         0.0,  0.0,  1.0,
         0.0,  0.0,  1.0,
         0.0,  0.0,  1.0,
  
        // Back face
         0.0,  0.0, -1.0,
         0.0,  0.0, -1.0,
         0.0,  0.0, -1.0,
         0.0,  0.0, -1.0,
  
        // Top face
         0.0,  1.0,  0.0,
         0.0,  1.0,  0.0,
         0.0,  1.0,  0.0,
         0.0,  1.0,  0.0,
  
        // Bottom face
         0.0, -1.0,  0.0,
         0.0, -1.0,  0.0,
         0.0, -1.0,  0.0,
         0.0, -1.0,  0.0,
  
        // Right face
         1.0,  0.0,  0.0,
         1.0,  0.0,  0.0,
         1.0,  0.0,  0.0,
         1.0,  0.0,  0.0,
  
        // Left face
        -1.0,  0.0,  0.0,
        -1.0,  0.0,  0.0,
        -1.0,  0.0,  0.0,
        -1.0,  0.0,  0.0
    ];
  
    var textureCoords = [
        // Front face
        0.0, 0.0,
        1.0, 0.0,
        1.0, 1.0,
        0.0, 1.0,
  
        // Back face
        1.0, 0.0,
        1.0, 1.0,
        0.0, 1.0,
        0.0, 0.0,
  
        // Top face
        0.0, 1.0,
        0.0, 0.0,
        1.0, 0.0,
        1.0, 1.0,
  
        // Bottom face
        1.0, 1.0,
        0.0, 1.0,
        0.0, 0.0,
        1.0, 0.0,
  
        // Right face
        1.0, 0.0,
        1.0, 1.0,
        0.0, 1.0,
        0.0, 0.0,
  
        // Left face
        0.0, 0.0,
        1.0, 0.0,
        1.0, 1.0,
        0.0, 1.0
    ];
  
    var indices = [
        0, 1, 2,      0, 2, 3,    // Front face
        4, 5, 6,      4, 6, 7,    // Back face
        8, 9, 10,     8, 10, 11,  // Top face
        12, 13, 14,   12, 14, 15, // Bottom face
        16, 17, 18,   16, 18, 19, // Right face
        20, 21, 22,   20, 22, 23  // Left face
    ];
  
    var cube = new object('cube');
  
    gl.bindBuffer(gl.ARRAY_BUFFER, cube.positionBuffer_);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    cube.positionBuffer_.itemSize = 3;
    cube.positionBuffer_.numItems = 24;
  
    gl.bindBuffer(gl.ARRAY_BUFFER, cube.normalBuffer_);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);
    cube.normalBuffer_.itemSize = 3;
    cube.normalBuffer_.numItems = 24;
  
    gl.bindBuffer(gl.ARRAY_BUFFER, cube.textureCoordBuffer_);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoords), gl.STATIC_DRAW);
    cube.textureCoordBuffer_.itemSize = 2;
    cube.textureCoordBuffer_.numItems = 24;
  
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cube.indexBuffer_);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
    cube.indexBuffer_.itemSize = 1;
    cube.indexBuffer_.numItems = 36;
    
    return cube;
  };

  objects.sphere = initSphere();
  objects.cube = initCube();
}

function drawScene() {
  gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  mat4.perspective(45, gl.viewportWidth / gl.viewportHeight, 0.1, 100.0, pMatrix);

  var shaderSelect = document.getElementById('shader-select');
  var newProgramId = shaderSelect.options[shaderSelect.selectedIndex].value;
  var newProgram = shaderPrograms[newProgramId];
  if (newProgram === undefined)
    return;

  if (newProgram != currentProgram) {
    console.log('Switching to ' + newProgram.displayName);
    currentProgram = newProgram;
    gl.useProgram(currentProgram);
  }
  
  if (currentProgram.shininessUniform) {
    gl.uniform1f(currentProgram.shininessUniform,
                 parseFloat(document.getElementById('shininess').value));
  }
   
  if (currentProgram.ambientColorUniform) {
    var ambient_lighting = document.getElementById('ambient_lighting').checked;
    if (ambient_lighting) {
      gl.uniform3f(currentProgram.ambientColorUniform,
                   parseFloat(document.getElementById('ambientR').value),
                   parseFloat(document.getElementById('ambientG').value),
                   parseFloat(document.getElementById('ambientB').value));
    } else {
      gl.uniform3f(currentProgram.ambientColorUniform, 0, 0, 0);
    }
  }
  
  if (currentProgram.pointLightingLocationUniform &&
      currentProgram.pointLightingColorUniform) {
    var point_lighting = document.getElementById('point_lighting').checked;
    if (point_lighting) {
      gl.uniform3f(currentProgram.pointLightingLocationUniform,
                   parseFloat(document.getElementById("lightPositionX").value),
                   parseFloat(document.getElementById("lightPositionY").value),
                   parseFloat(document.getElementById("lightPositionZ").value));
  
      gl.uniform3f(currentProgram.pointLightingColorUniform,
                   parseFloat(document.getElementById("positionR").value),
                   parseFloat(document.getElementById("positionG").value),
                   parseFloat(document.getElementById("positionB").value));
    } else {
      gl.uniform3f(currentProgram.pointLightingColorUniform, 0, 0, 0);
    }
  }

  mat4.identity(mvMatrix);
  mat4.translate(mvMatrix, [0, 0, -6]);
  mat4.multiply(mvMatrix, rotationMatrix);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, gridTexture);
  gl.uniform1i(currentProgram.samplerUniform, 0);

  var objectSelect = document.getElementById('object-select');
  var newObjectId = objectSelect.options[objectSelect.selectedIndex].value;
  var newObject = objects[newObjectId];
  if (newObject === undefined)
    return;
    
  if (newObject != currentObject) {
    console.log('Switching to ' + newObjectId);
    currentObject = newObject;
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, currentObject.positionBuffer_);
  gl.vertexAttribPointer(currentProgram.vertexPositionAttribute,
                         currentObject.positionBuffer_.itemSize, gl.FLOAT, false, 0, 0);

  if (currentProgram.textureCoordAttribute >= 0) {
    gl.bindBuffer(gl.ARRAY_BUFFER, currentObject.textureCoordBuffer_);
    gl.vertexAttribPointer(currentProgram.textureCoordAttribute,
                           currentObject.textureCoordBuffer_.itemSize, gl.FLOAT, false, 0, 0);
  }
  
  if (currentProgram.vertexNormalAttribute >= 0) {
    gl.bindBuffer(gl.ARRAY_BUFFER, currentObject.normalBuffer_);
    gl.vertexAttribPointer(currentProgram.vertexNormalAttribute,
                           currentObject.normalBuffer_.itemSize, gl.FLOAT, false, 0, 0);
  }
  
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, currentObject.indexBuffer_);
  setMatrixUniforms();
  gl.drawElements(gl.TRIANGLES, currentObject.indexBuffer_.numItems, gl.UNSIGNED_SHORT, 0);
}

function tick() {
  requestAnimFrame(tick);
  drawScene();
}

function webGLStart() {
  var canvas = document.getElementById("webglSphereShader-canvas");
  initGL(canvas);
  initShaders();
  initObjects();
  initTexture();

  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.enable(gl.DEPTH_TEST);

  canvas.onmousedown = handleMouseDown;
  document.onmouseup = handleMouseUp;
  document.onmousemove = handleMouseMove;

  tick();
}