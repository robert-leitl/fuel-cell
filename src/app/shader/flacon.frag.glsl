uniform float uFakeShadowStrength;
uniform float uFresnelStrength;

in vec3 vModelPosition;

void main(void) {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(vViewPosition);
  float fresnel = smoothstep(0., .2, dot(N, V)) * 0.8 + 0.2;
  float shadow = mix(1., fresnel, uFakeShadowStrength * (1. - vModelPosition.y * 12.));
  float bottom = smoothstep(0., 1., min(1., (vModelPosition.y * 60.)));
  bottom = bottom * 0.6 + .4;
  vec3 bottomColor = mix(vec3(1.), vec3(bottom, bottom * 0.95 + 0.05, bottom * 0.9 + 0.1), uFakeShadowStrength + .1);
  bottomColor *= vec3(0.95, 0.95, 1.);

  float top = smoothstep(0.7, 1., max(0., ((0.127 - vModelPosition.y) * 50.)));
  top = top * 0.4 + 0.6;
  vec3 topColor = mix(vec3(1.), vec3(top), uFakeShadowStrength);

  float ao = mix(1., smoothstep(.6, 1., length(vModelPosition.xz) * 50.), vModelPosition.y * 10.);
  ao = ao * 0.4 + 0.6;

  csm_DiffuseColor.rgb *= shadow * ao;
  csm_DiffuseColor.rgb *= bottomColor;
  csm_DiffuseColor.rgb *= topColor;

  float outline = smoothstep(0., 1., dot(N, V));
  outline = outline * .9 + .1;
  outline = mix(1., outline, uFakeShadowStrength);
  csm_DiffuseColor.rgb *= outline;

  csm_DiffuseColor.rgb += (1. - fresnel) * uFresnelStrength;

}
