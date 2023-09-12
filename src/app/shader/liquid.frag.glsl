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

void main() {
    vec3 modelPos = vModelPosition;
    float levelDist = sdPlane(modelPos, uSurfacePlane.xyz, uSurfacePlane.w) / uDims.x;
    
    if (levelDist > 0.) discard;

    float attenuation = 1. - smoothstep(0., 1., -levelDist + 0.7 );
    attenuation += (1. - smoothstep(0., 1., -levelDist * 4. + 0.8 )) * 5.;

    vec3 color = vec3(0., 0.2, 2.);
    color *= attenuation + .1;

    vec3 surfaceNormal = vec3(0.);
    if (!gl_FrontFacing) {
        color = vec3(0., 0.4, 2.2);

        // find the surface intersection
        mat4 inversModelMatrix = inverse(modelMatrix);
        vec3 C = (inversModelMatrix * vec4(cameraPosition, 1.)).xyz;
        vec3 V = normalize(C - modelPos);
        float intersectDist = plaIntersect(modelPos, V, uSurfacePlane);
        vec3 surfacePoint = modelPos + intersectDist * V;
        //float capsDist = sdCappedCylinder(surfacePoint, uDims.y * 0.4, uDims.x * 0.4);
        float capsDist = sdRoundedCylinder(surfacePoint, uDims.x * 0.1, uDims.x * 0.3, uDims.y * 0.35);
        float surfaceOffsetStrength = smoothstep(0., 1., capsDist * 30.);
        vec3 surfaceCenter = -uSurfacePlane.xyz * uSurfacePlane.w;
        vec3 surfaceOffsetPoint = normalize(surfaceCenter - surfacePoint);

        surfaceNormal = uSurfacePlane.xyz;
        surfaceNormal += surfaceOffsetPoint * surfaceOffsetStrength * 2.;
    }

    csm_DiffuseColor = vec4(color, 1.);
}
