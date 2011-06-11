/**

StreetViewInvasion.js
http://ysugano.tumblr.com/
http://tokyo.fffff.at/

requires PhiloGL: http://senchalabs.github.com/philogl/

*/

function StreetViewInvasion() {
	/* streetview-related settings */
	this.panoramaOptions = {
		addressControl: false,
		navigationControl: false,
		linksControl: false,
		visible:true
	};
	this.streetview;
	
	/* webgl-related settings */
	this.layerID = 'gl_overlay';
	this.textureName = 'texture_image';
	this.textureSize = 256;
	this.textureImg = new Image();
	this.textureCanvas;
	this.textureCtx;
	
	this.camera_target;
	this.frameBox = new PhiloGL.O3D.Cube({
		textures: this.textureName
	});
	
	this.gl;
	this.program;
	this.scene;
	this.canvas;
	this.camera;
	
	this.initialize.apply(this, arguments);
}

StreetViewInvasion.prototype.initialize = function(divID) {
	var svDiv = document.getElementById(divID);
	var w = svDiv.getAttribute('width');
	var h = svDiv.getAttribute('height');
	svDiv.setAttribute('style', 'position: relative; z-index: 1; width: '+w+'; height: '+h+';');
	
	this.streetview = new google.maps.StreetViewPanorama(svDiv, this.panoramaOptions);
	var obj = this;
	var func = function (){ obj.povChanged(); };
	google.maps.event.addListenerOnce(this.streetview, 'pov_changed', func);
	
	var glOverLay = document.createElement('canvas');
	glOverLay.setAttribute('id', this.layerID);
	glOverLay.setAttribute('width', w);
	glOverLay.setAttribute('height', h);
	glOverLay.setAttribute('style', 'position: absolute; top: 0; left: 0; z-index: 2; pointer-events: none;');
	svDiv.appendChild(glOverLay);
	
	this.textureCanvas = document.createElement('canvas');
	this.textureCanvas.setAttribute('width', this.textureSize);
	this.textureCanvas.setAttribute('height', this.textureSize);
	this.textureCanvas.setAttribute('style', "display: none;");
	document.body.appendChild(this.textureCanvas);
	this.textureCtx = this.textureCanvas.getContext("2d");
	
	/**
	horizontal FoV should be 90 degree
	http://code.google.com/apis/maps/documentation/javascript/services.html
	*/
	var fov = 2*Math.atan(parseFloat(h)/parseFloat(w))/(Math.PI/180);
	this.webGLsetup(fov);
}

StreetViewInvasion.prototype.setLocation = function(latitude, longitude, heading, pitch) {
	this.streetview.setPosition(new google.maps.LatLng(latitude, longitude));
	this.streetview.setPov({
		heading: heading,
		pitch: pitch,
		zoom: 1
	});
	this.povChanged();
}

StreetViewInvasion.prototype.setFrame = function(width, height, x, y, z, roll, pitch, yaw) {
	this.frameBox.scale = {
		x: width, 
		y: height, 
		z: 0
	};
	this.frameBox.position = {
		x: x,
		y: y,
		z: z
	};
	this.frameBox.rotation = {
		x: pitch,
		y: yaw,
		z: roll
	};
	this.frameBox.update();
}

StreetViewInvasion.prototype.setFrameDegree = function(width, height, x, y, z, roll, pitch, yaw) {
	var rollrad = roll*(Math.PI/180);
	var pitchrad = pitch*(Math.PI/180);
	var yawrad = yaw*(Math.PI/180);
	this.setFrame(width, height, x, y, z, rollrad, pitchrad, yawrad);
}

StreetViewInvasion.prototype.setTexture = function(img_path) {
	this.textureCtx.clearRect(0, 0, this.textureCanvas.width, this.textureCanvas.height);
	this.textureImg.src = img_path;
}

StreetViewInvasion.prototype.getPov = function() {
	return this.streetview.getPov();
}	

StreetViewInvasion.prototype.convertPOV2Cam = function(pov) {
	var theta = Math.PI*(90-pov.pitch)/180;
	var phi = Math.PI*pov.heading/180;
	var target = {
		x: Math.sin(theta)*Math.cos(phi),
		y: Math.cos(theta),
		z: Math.sin(theta)*Math.sin(phi)
	}
	
	return target;
}

StreetViewInvasion.prototype.povChanged = function() {
	var pov = this.streetview.getPov();
	var new_pov = {
		heading: pov.heading,
		pitch: pov.pitch,
		zoom: 1
	};
	this.streetview.setPov(new_pov);
	
	this.camera_target = this.convertPOV2Cam(new_pov);
	
	var obj = this;
	var func = function(){ obj.povChanged(); };
	google.maps.event.addListenerOnce(this.streetview, 'pov_changed', func);
}

StreetViewInvasion.prototype.webGLonLoadImage = function() {
	this.textureCtx.drawImage(this.textureImg, 0, 0, this.textureImg.width, this.textureImg.height, 
								0, 0, this.textureCanvas.width, this.textureCanvas.height);
	
	this.program.setTexture(this.textureName, {
		data: {
			value: this.textureCanvas
		}
	});
}

StreetViewInvasion.prototype.webGLDraw = function() {
	this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
	
	this.camera.target = this.camera_target;
	this.camera.update();

	this.scene.render();
}

StreetViewInvasion.prototype.webGLonLoad = function(app) {
	this.gl = app.gl;
	this.program = app.program;
	this.scene = app.scene;
	this.canvas = app.canvas;
	this.camera = app.camera;

	this.gl.clearColor(0.0, 0.0, 0.0, 0.0);
	this.gl.clearDepth(1.0);
	this.gl.enable(this.gl.DEPTH_TEST);
	this.gl.depthFunc(this.gl.LEQUAL);
	this.gl.viewport(0, 0, +this.canvas.width, +this.canvas.height);
	
	var obj = this;
	var funcImgLoad = function(){ obj.webGLonLoadImage(); };
	var funcDraw = function(){ obj.webGLDraw(); };
	
	this.textureImg.onload = funcImgLoad;

	this.program.setTexture(this.textureName, {
		data: {
			value: this.textureCanvas
		}
	});
	
	this.scene.add(this.frameBox);
	
	setInterval(funcDraw, 1000/60);
}

StreetViewInvasion.prototype.webGLsetup = function(fov) {
	var obj = this;
	var func = function(app){ obj.webGLonLoad(app); };
	
	//Create PhiloGL app
	PhiloGL(this.layerID, {
		camera: {
			fov: fov,
			near: 1,
			far: 1000,
			position: {
				x: 0,
				y: 0,
				z: 0
			},
			target: this.camera_target
		},
		scene: {
			lights: {
				enable: false,
			}
		},
		onError: function() {
			alert("There was an error creating the app.");
		},
		onLoad: func
	});
}
