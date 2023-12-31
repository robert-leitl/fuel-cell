uniform vec4 uSurfacePlane;
uniform vec3 uGroundLevelOffset;
uniform vec3 uDims;
uniform mat4 modelMatrix;
uniform mat3 normalMatrix;

in vec3 vModelPosition;
in vec3 vWorldPosition;

float sdPlane( vec3 p, vec3 n, float h )
{
  // n must be normalized
  return dot(p,n) + h;
}

// plane defined by p (p.xyz must be normalized)
float plaIntersect( in vec3 ro, in vec3 rd, in vec4 p )
{
    return -(dot(ro,p.xyz)+p.w)/dot(rd,p.xyz);
}

float sdCappedCylinder( vec3 p, float h, float r )
{
  vec2 d = abs(vec2(length(p.xz),p.y)) - vec2(r,h);
  return min(max(d.x,d.y),0.0) + length(max(d,0.0));
}

float sdRoundedCylinder( vec3 p, float ra, float rb, float h )
{
  vec2 d = vec2( length(p.xz)-2.0*ra+rb, abs(p.y) - h );
  return min(max(d.x,d.y),0.0) + length(max(d,0.0)) - rb;
}

float map(vec3 p) {
    return sdRoundedCylinder(p, uDims.x * 0.1, uDims.x * 0.3, uDims.y * 0.34);
}

vec3 calcNormal( in vec3 p ) // for function f(p)
{
    const float h = 0.0001;      // replace by an appropriate value
    #define ZERO (min(int(uDims.x),0)) // non-constant zero
    vec3 n = vec3(0.0);
    for( int i=ZERO; i<4; i++ )
    {
        vec3 e = 0.5773*(2.0*vec3((((i+3)>>1)&1),((i>>1)&1),(i&1))-1.0);
        n += e*map(p+e*h);
    }
    return normalize(n);
}

void main() {
    vec3 modelPos = vModelPosition;
    float levelDist = sdPlane(modelPos, uSurfacePlane.xyz, uSurfacePlane.w) / uDims.x;
    
    if (levelDist > 0.) discard;

    float attenuation = (1. - smoothstep(0., 1., -levelDist + 0.7 )) * 5.;
    attenuation += (1. - smoothstep(0., 1., -levelDist * 4. + 0.8 )) * 10.;

    vec3 color = vec3(0., 0.2, 2.) * 1.5;
    color *= attenuation + .2;

    vec3 surfaceNormal = vec3(0.);
    if (!gl_FrontFacing) {
        color = vec3(0., 0.4, 2.2) * 1.5;

        // find the surface intersection
        mat4 inversModelMatrix = inverse(modelMatrix);
        vec3 C = (inversModelMatrix * vec4(cameraPosition, 1.)).xyz;
        vec3 V = normalize(C - modelPos);
        float intersectDist = plaIntersect(modelPos, V, uSurfacePlane);
        vec3 surfacePoint = modelPos + intersectDist * V;

        float capsDist = map(surfacePoint);
        float surfaceOffsetStrength = smoothstep(0., 1., capsDist * 30.);

        vec3 sdNorm = calcNormal(surfacePoint);

        surfaceNormal = uSurfacePlane.xyz;
        surfaceNormal += sdNorm * surfaceOffsetStrength * 2.;
    }

    csm_DiffuseColor = vec4(color * 2., 1.);
}
