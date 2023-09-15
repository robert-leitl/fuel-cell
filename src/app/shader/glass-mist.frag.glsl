uniform sampler2D uColor;
uniform sampler2D uIceBump;
uniform sampler2D uGlassBump;
uniform vec4 uSurfacePlane;
uniform vec3 uDims;

in vec3 vModelPosition;
in vec2 vUv;

layout(location = 0) out vec4 outColor;

float sdPlane( vec3 p, vec3 n, float h )
{
  // n must be normalized
  return dot(p,n) + h;
}

void main() {
    vec3 modelPos = vModelPosition;
    float levelDist = sdPlane(modelPos, uSurfacePlane.xyz, uSurfacePlane.w + 0.00001) / uDims.x;
    levelDist = min(1., max(0., levelDist * -1.));

    
    vec4 iceBump = texture(uIceBump, vUv);
    vec4 glassBump = texture(uGlassBump, vUv);
    float glassBumpValue = glassBump.r * 0.05;
    vec4 target = vec4(levelDist, 0., 0., 0.);


    target.r = levelDist * iceBump.r; // roughness
    target.g = (levelDist * (iceBump.r * 0.4 + 0.6)) * 0.5 + 0.01; // transmission
    target.b = mix(glassBumpValue, iceBump.r, levelDist); // bump
    target.a = (1. - levelDist) * 0.5 + glassBumpValue * 20. * (1. - levelDist); // specular intensity

    vec4 prevValue = texture(uColor, vUv);
    vec4 value = prevValue + (target - prevValue) * 0.015;
    value.r = prevValue.r + (target.r - prevValue.r) * 0.01;
    value.g = prevValue.g + (target.g - prevValue.g) * 0.0095;
    value.b = prevValue.b + (target.b - prevValue.b) * 0.02;

    outColor = value;
}
