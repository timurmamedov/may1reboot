//=require ../vendor/**/*.js

//=require utils.js
//=require three/*.js

var config = {
  earthRadius:8
};

var Globe = function() {
  this.root = new THREERoot({
    createCameraControls:false,
    fov:20
  });
  this.root.renderer.setClearColor(0x080808);

  this.root.camera.position.y = 160;

  var light = new THREE.DirectionalLight(0xffffff, 1.0);
  light.position.set(-2.0, 4.0, 1).normalize();
  this.root.scene.add(light);

  this.initPostProcessing();

  this.root.onUpdate = _.bind(this.update, this);

  TweenMax.set(this.root.renderer.domElement, {opacity:0});

  var loader = new THREE.TextureLoader();

  loader.load('res/tex/earth_lights.png', _.bind(function(texture) {
    this.processMarkerPositions(texture.image);

    this.initEarth(texture);
    this.initStars();
    this.createIntroAnimation();

  }, this));

  console.warn = function() {};
};
Globe.prototype = {
  initPostProcessing:function() {
    var renderPass = new THREE.RenderPass(this.root.scene, this.root.camera);
    var bloomPass = new THREE.BloomPass(1.25, 25, 4.0, 512);
    var hBlurPass = new THREE.ShaderPass(THREE.HorizontalBlurShader);
    var vBlurPass = new THREE.ShaderPass(THREE.VerticalBlurShader);
    var copyPass = new THREE.ShaderPass(THREE.CopyShader);
    var vignettePass = new THREE.ShaderPass(THREE.VignetteShader);

    var blendPass = new THREE.ShaderPass(THREE.BlendShader, 'tDiffuse1');
    var savePass = new THREE.SavePass(new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight));

    hBlurPass.uniforms.h.value = 1.0 / window.innerWidth;
    vBlurPass.uniforms.v.value = 1.0 / window.innerHeight;
    hBlurPass.uniforms.strength.value = 1.0;
    vBlurPass.uniforms.strength.value = 1.0;

    this.hBlurPass = hBlurPass;
    this.vBlurPass = vBlurPass;

    blendPass.uniforms['tDiffuse2'].value = savePass.renderTarget;
    blendPass.uniforms['mixRatio'].value = 0.5;
    blendPass.uniforms['opacity'].value = 1.00;

    this.root.initPostProcessing([
      renderPass,
      bloomPass,
      //hBlurPass,
      //vBlurPass,
      blendPass,
      savePass,
      vignettePass
    ]);
  },

  update:function() {
    //if (this.lastCamPos) {
    //  var delta = new THREE.Vector3();
    //
    //  delta.subVectors(this.root.camera.position, this.lastCamPos);
    //
    //  var lx = delta.x * 0.25;
    //  var ly = delta.y * 0.25;
    //
    //  this.hBlurPass.uniforms.strength.value = lx;
    //  this.vBlurPass.uniforms.strength.value = ly;
    //}
    //
    //this.lastCamPos = this.root.camera.position.clone();
  },

  processMarkerPositions:function(img) {
    this.markerPositions = [];

    var cnv = document.createElement('canvas');
    var ctx = cnv.getContext('2d');

    cnv.width = img.width * 0.5;
    cnv.height = img.height * 0.5;

    ctx.drawImage(img, 0, 0, cnv.width, cnv.height);

    var data = ctx.getImageData(0, 0, cnv.width, cnv.height).data;
    var threshold = 200;

    var positions = [];

    for (var i = 0; i < data.length; i+=4) {
      var r = data[i];

      if (r > threshold) {
        var x = (i / 4) % cnv.width;
        var y = ((i / 4) / cnv.width) | 0;

        positions.push({x:x / cnv.width, y:y / cnv.height});
      }
    }

    positions.sort(function(a, b) {
      return a.x < b.x;
    });

    console.log('position count', positions.length);

    for (var j = 0; j < positions.length; j++) {
      var p = positions[j];
      var lat = THREE.Math.mapLinear(p.y, 0, 1, 90, -90);
      var lon = THREE.Math.mapLinear(p.x, 0, 1, -180, 180);

      this.markerPositions[j] = utils.llToVec(lat, lon, config.earthRadius);
    }
  },

  initEarth:function(texture) {
    var geo = new THREE.SphereGeometry(config.earthRadius, 128, 128);
    var mat = new THREE.MeshPhongMaterial({
      map: texture,
      specularMap: THREE.ImageUtils.loadTexture('res/tex/earth_spec.jpg'),
      displacementMap: THREE.ImageUtils.loadTexture('res/tex/earth_bump.jpg'),
      displacementScale: 0.5,
      bumpMap: THREE.ImageUtils.loadTexture('res/tex/earth_bump.jpg'),
      bumpScale: 0.5,
      shininess: 8,
      specular:0x222222
    });
    var mesh = new THREE.Mesh(geo, mat);

    this.earth = mesh;
    this.root.scene.add(mesh);

    var earthRotationController = new ObjectRotator(mesh);

    TweenMax.ticker.addEventListener('tick', function() {
      earthRotationController.update();
    });

    //var halo = new THREE.Mesh(
    //  new THREE.SphereGeometry(config.earthRadius + 0.5, 64, 64),
    //  new THREE.MeshPhongMaterial({
    //    transparent:true,
    //    opacity:0.05,
    //    color:0xffffff,
    //    //side:THREE.BackSide
    //  })
    //);
    //
    //mesh.add(halo);

    //TweenMax.to(mesh.rotation, 24, {y:Math.PI * 2, ease:Power0.easeIn, repeat:-1});
  },

  initStars:function() {
    var prefabGeometry = new THREE.TetrahedronGeometry(0.75);
    var starSystem = new StarAnimationSystem(prefabGeometry, 2000, 100, 1000);

    TweenMax.ticker.addEventListener('tick', function() {
      starSystem.update();
    });

    this.root.scene.add(starSystem);
  },

  createIntroAnimation:function() {
    var controls = this.root.controls;
    var hBlurPass = this.hBlurPass;
    var vBlurPass = this.vBlurPass;

    var tl = new TimelineMax({repeat:0});

    tl.call(function() {
      //controls.enabled = false;
      hBlurPass.enabled = false;
      vBlurPass.enabled = false;
    });
    tl.to(this.root.renderer.domElement, 0.25, {opacity:1}, 0);

    tl.add(this.createCameraAnimation(10), 0.0);
    tl.add(this.createMarkersAnimation(10), 0.0);

    tl.call(function() {
      //controls.enabled = true;
      hBlurPass.enabled = true;
      vBlurPass.enabled = true;
    });

    tl.timeScale(2);
  },

  createMarkersAnimation:function(duration) {
    var prefabGeometry = new THREE.SphereGeometry(0.025, 16, 16);
    var markerSystem = new MarkerAnimationSystem(prefabGeometry, this.markerPositions);
    var animation = TweenMax.fromTo(markerSystem, duration,
      {animationProgress:0},
      {animationProgress:1, ease:Power0.easeIn}
    );

    this.earth.add(markerSystem);

    return animation;
  },

  createCameraAnimation:function(duration) {
    var proxy = {
      angle:Math.PI * 1.25,
      distance:400,
      eyeHeight:60
    };
    var eyeHeight = 8;
    var camera = this.root.camera;
    var target = new THREE.Vector3(0, eyeHeight, 0);

    var tl = new TimelineMax({
      onUpdate:function() {
        var x = Math.cos(proxy.angle) * proxy.distance;
        var y = proxy.eyeHeight;
        var z = Math.sin(proxy.angle) * proxy.distance;

        camera.position.set(x, y, z);
        camera.lookAt(target);
      }
    });

    tl.to(proxy, duration, {angle:Math.PI * -1.5, distance:32, eyeHeight:eyeHeight, ease:Power1.easeOut});

    return tl;
  }
};

window.globe = new Globe();
