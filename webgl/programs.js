/* This file (programs.js) is compiled from programs.co. Please view the
original commented source there. */
(function(){
  "use strict";
  var programs, load, plainQuadVertex, out$ = typeof exports != 'undefined' && exports || this;
  programs = {};
  out$.load = load = function(it, gl){
    return programs[it](gl);
  };
  plainQuadVertex = "precision mediump float;\n\nattribute vec2 vertexCoord;\nattribute vec2 texCoord;\n\nvarying vec2 tex;\n\nvoid main() {\n  tex = texCoord;\n  gl_Position = vec4(vertexCoord.xy, 1., 1);\n}";
  programs.globe = shaderProgram({
    vertex: "precision mediump float;\n\nattribute vec3 modelCoord;\nattribute vec2 texCoord;\n\nvarying vec2 tex;\n\nuniform mat4 ModelViewMatrix;\nuniform mat4 ProjectionMatrix;\n\nvoid main() {\n  tex = texCoord;\n\n  vec4 WorldCoord = ModelViewMatrix * vec4(modelCoord,1.0);\n\n  gl_Position = ProjectionMatrix * WorldCoord;\n}",
    fragment: "precision mediump float;\n\nuniform sampler2D texture;\n\nvarying vec2 tex; // coords\n\nuniform sampler2D oceanCurrent;\nuniform sampler2D earthTexture;\n\nbool isWater(vec2 coords) {\n  vec3 val = texture2D(oceanCurrent, coords).xyz;\n  return val.z != 0.0;\n}\n\n// transform packed texture field\nvec2 fieldAt(vec2 coords) {\n  vec3 val = texture2D(oceanCurrent, coords).xyz;\n  return vec2(val.x - 0.5, val.y - 0.5);\n}\n\n// tweak variables for masking\nuniform float m;\nuniform float n;\n\nuniform bool mask;\n\nvoid main() {\n  if (isWater(tex)) {\n    vec4 pixel = texture2D(texture, tex);\n\n    float magnitude = length(fieldAt(tex));\n\n    // not in paper, but in 2002 e/l texture advection:\n    // masking by magnitude\n    vec4 alpha = vec4(1., 1., 1., 1.);\n    if (mask) {\n      float ratio = min(magnitude / 0.5, 1.);\n      alpha = (1. - pow(1. - ratio, m)) * (1. - pow(1. - pixel, vec4(n)));\n    }\n\n    gl_FragColor = pixel * alpha;\n  } else {\n    gl_FragColor = texture2D(earthTexture, tex);\n  }\n}",
    uniforms: {
      mask: ['1i', true],
      m: ['1f', 10],
      n: ['1f', 3]
    }
  });
  programs.noiseTransport = shaderProgram({
    vertex: plainQuadVertex,
    fragment: "precision mediump float;\n\nuniform sampler2D field;\nuniform sampler2D noise;\n\nvarying vec2 tex;\n\nuniform vec2 randomOffset;\n\n// transform packed texture field\nvec2 fieldAt(vec2 coords) {\n  vec3 val = texture2D(field, coords).xyz;\n  return vec2(val.x - 0.5, val.y - 0.5);\n}\n\nbool isWater(vec2 coords) {\n  vec3 val = texture2D(field, coords).xyz;\n  return val.z != 0.0;\n}\n\nvec2 size = vec2(1024., 512.);\n\nvoid main() {\n  if (isWater(tex)) {\n    vec2 currentPosition = tex + randomOffset;\n    vec2 field = fieldAt(tex);\n\n    float h = 10.0;\n    vec2 advectedPosition = currentPosition + field * h / size;\n\n    gl_FragColor = texture2D(noise, advectedPosition);\n  } else {\n    gl_FragColor = texture2D(noise, tex);\n  }\n}"
  });
  programs.orthogonalLic = shaderProgram({
    vertex: plainQuadVertex,
    fragment: "precision mediump float;\n\nuniform sampler2D oceanCurrent;\nuniform sampler2D transportedNoise;\n\nvarying vec2 tex;\n\n// transform packed texture field\nvec2 orthogonalFieldAt(vec2 coords) {\n  vec3 val = texture2D(oceanCurrent, coords).xyz;\n  return vec2(-(val.y - 0.5), val.x - 0.5);\n}\n\nbool isWater(vec2 coords) {\n  vec3 val = texture2D(oceanCurrent, coords).xyz;\n  return val.z != 0.0;\n}\n\nvec2 size = vec2(1024., 512.);\n\nvoid main() {\n  if (isWater(tex)) {\n    float h = 0.75;\n\n    // LIC backwards and forwards\n    vec3 pixel = vec3(0.0, 0.0, 0.0);\n    vec2 pos = tex;\n\n    vec2 field = orthogonalFieldAt(pos);\n    for(int i = 0; i < 25; ++i) {\n      pixel = pixel + texture2D(transportedNoise, pos).rgb;\n      pos = pos - field * h / size;\n      field = orthogonalFieldAt(pos);\n    }\n    pos = tex;\n    field = orthogonalFieldAt(pos);\n    for(int i = 0; i < 25; ++i) {\n      pixel = pixel + texture2D(transportedNoise, pos).rgb;\n      pos = pos + field * h / size;\n      field = orthogonalFieldAt(pos);\n    }\n\n    // average\n    pixel = pixel / 50.0;\n\n    gl_FragColor = vec4(pixel, 1.0);\n  } else {\n    gl_FragColor = texture2D(transportedNoise, tex);\n  }\n}"
  });
  programs.advection = shaderProgram({
    vertex: plainQuadVertex,
    fragment: "precision mediump float;\n\nuniform sampler2D oceanCurrent;\nuniform sampler2D previousTexture;\n\nvarying vec2 tex;\n\n// transform packed texture field\nvec2 fieldAt(vec2 coords) {\n  vec3 val = texture2D(oceanCurrent, coords).xyz;\n  return vec2(val.x - 0.5, val.y - 0.5);\n}\n\nbool isWater(vec2 coords) {\n  vec3 val = texture2D(oceanCurrent, coords).xyz;\n  return val.z != 0.0;\n}\n\nvec2 size = vec2(1024., 512.);\n\nvoid main() {\n  if (isWater(tex)) {\n    vec2 currentPosition = tex;\n\n    float h = 0.125;\n\n    vec2 pos = tex;\n    vec2 field = fieldAt(pos);\n    for(int i = 0; i < 35; ++i) {\n      pos = pos - field * h / size;\n      field = fieldAt(pos);\n    }\n\n    gl_FragColor = vec4(texture2D(previousTexture, pos));\n  } else {\n    gl_FragColor = texture2D(previousTexture, tex);\n  }\n}"
  });
  programs.blend = shaderProgram({
    vertex: plainQuadVertex,
    fragment: "precision mediump float;\n\nuniform sampler2D orthogonalLIC;\nuniform sampler2D advected;\n\nuniform sampler2D oceanCurrent;\n\nbool isWater(vec2 coords) {\n  vec3 val = texture2D(oceanCurrent, coords).xyz;\n  return val.z != 0.0;\n}\n\n// transform packed texture field\nvec2 fieldAt(vec2 coords) {\n  vec3 val = texture2D(oceanCurrent, coords).xyz;\n  return vec2(val.x - 0.5, val.y - 0.5);\n}\n\nvarying vec2 tex;\n\nvoid main() {\n  vec4 pixel   = texture2D(orthogonalLIC, tex) * 0.05\n               + texture2D(advected     , tex) * 0.95;\n\n  gl_FragColor = pixel;\n}"
  });
}).call(this);
