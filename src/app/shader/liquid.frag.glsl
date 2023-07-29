uniform sampler2D uDepthTexture;

in vec3 vModelPosition;

vec3 rgb2hsv(in vec3 rgb)
{
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(rgb.bg, K.wz), vec4(rgb.gb, K.xy), step(rgb.b, rgb.g));
    vec4 q = mix(vec4(p.xyw, rgb.r), vec4(rgb.r, p.yzx), step(p.x, rgb.r));

    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;

    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb( in vec3 hsv )
{
    vec3 rgb = clamp( abs(mod(hsv.x*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0, 0.0, 1.0 );

    return hsv.z * mix( vec3(1.0), rgb, hsv.y);
}

void main() {
    vec2 depthTexSize = vec2(textureSize(uDepthTexture, 0));
    vec2 st = gl_FragCoord.xy / depthTexSize;
    float depth = texture(uDepthTexture, st).r;

    float near = projectionMatrix[3][2]/(projectionMatrix[2][2] - 1.);
    float far = projectionMatrix[3][2]/(projectionMatrix[2][2] + 1.);
    float viewZ = perspectiveDepthToViewZ(depth, near, far);
    viewZ = max(-.32, viewZ);
    float orthoDepth = viewZToOrthographicDepth(viewZ, near, far);
    float deltaZ = -viewZ - vViewPosition.z;
    float depthAttenuation = 1. - smoothstep(0., 1., deltaZ * 45.);
    float customTransmission = 0.9; //depthAttenuation * 0.5 + 0.5;
    //depthAttenuation = depthAttenuation * 0.5 + 0.5;

    vec3 N = normalize(vNormal);
    vec3 V = normalize(vViewPosition);
    float fresnelAttenuation = smoothstep(0.2, .5, deltaZ * 15.);
    fresnelAttenuation = fresnelAttenuation * 0.3 + 0.7;

    vec3 gradientColor3 = vec3(1., .8, .6);
    vec3 gradientColor4 = vec3(1., .85, .6);

    gradientColor4 = rgb2hsv(gradientColor4);
    gradientColor4.g = .5;
    gradientColor4.b = 1.5;
    gradientColor4 = hsv2rgb(gradientColor4);
    gradientColor3 = rgb2hsv(gradientColor3);
    gradientColor3.r -= .01;
    gradientColor3.g = .2;
    gradientColor3.b = 1.5;
    gradientColor3 = hsv2rgb(gradientColor3);

    csm_DiffuseColor.rgb = mix(gradientColor4, gradientColor3, depthAttenuation * 2.);

    /*csm_DiffuseColor.r *= depthAttenuation * 0.9 + 0.1;
    csm_DiffuseColor.g *= depthAttenuation;
    csm_DiffuseColor.b *= depthAttenuation;*/

    //csm_DiffuseColor.rgb = mix(csm_DiffuseColor.rgb, darkLiq, 0.);

    //csm_DiffuseColor.rgb += (1. - fresnelAttenuation) * 0.7;
}
