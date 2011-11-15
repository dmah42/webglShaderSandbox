#ifdef GL_ES
precision highp float;
#endif

varying vec2 vTextureCoord;
varying vec3 vTransformedNormal;
varying vec4 vPosition;

uniform vec3 uAmbientColor;
uniform float uShininess;

uniform vec3 uPointLightingLocation;
uniform vec3 uPointLightingColor;

uniform sampler2D uSampler;

void main(void) {
  vec3 lightDirection = normalize(uPointLightingLocation - vPosition.xyz);
  vec3 eyePosition = normalize(-vPosition.xyz);
  vec3 reflected = normalize(-reflect(lightDirection, normalize(vTransformedNormal)));

  float directionalLightWeighting = max(dot(normalize(vTransformedNormal), lightDirection), 0.0);

  float specularLightWeighting = pow(max(dot(reflected, eyePosition), 0.0), uShininess);

  vec3 lightWeighting = uAmbientColor +
                        uPointLightingColor * directionalLightWeighting +
                        uPointLightingColor * specularLightWeighting;

  vec4 fragmentColor = texture2D(uSampler, vec2(vTextureCoord.s, vTextureCoord.t));
  gl_FragColor = vec4(fragmentColor.rgb * lightWeighting, fragmentColor.a);
}
