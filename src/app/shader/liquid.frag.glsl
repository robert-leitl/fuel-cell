uniform vec3 uLevel;
uniform vec3 uGroundLevelOffset;
uniform vec3 uDims;

in vec3 vModelPosition;

void main() {
    vec3 modelPos = vModelPosition - uGroundLevelOffset;
    vec3 levelPlane = uLevel;
    float planeDist = length(levelPlane);
    vec3 planeNorm = normalize(levelPlane);
    float levelDist = (dot(modelPos, planeNorm) - planeDist) / uDims.x;

    if (levelDist > 0.) discard;

    float attenuation = 1. - smoothstep(0., 1., -levelDist + 0.7 );
    attenuation += (1. - smoothstep(0., 1., -levelDist * 4. + 0.8 )) * 5.;

    vec3 color = vec3(0., 0.1, 1.);
    color *= attenuation + .1;

    vec3 norm = normalize(vNormal);

    color = gl_FrontFacing ? color : vec3(0., 0.2, 1.1);

    //color = vec3(norm);

    csm_DiffuseColor = vec4(color, 1.);
}
