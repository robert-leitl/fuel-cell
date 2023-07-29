uniform sampler2D uColor;
uniform sampler2D uBloom;

layout(location = 0) out vec4 outColor;

in vec2 vUv;

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

vec3 vibrance(in vec3 color, in float v) {
    float average = (color.r + color.g + color.b) / 3.0;
    float mx = max(color.r, max(color.g, color.b));
    float amt = (mx - average) * (-v * 3.0);
    return mix(color.rgb, vec3(mx), amt);
}
vec4 vibrance(in vec4 color, in float v) { return vec4( vibrance(color.rgb, v), color.a); }

float brightnessContrast( float value, float brightness, float contrast ) {
    return ( value - 0.5 ) * contrast + 0.5 + brightness;
}

vec3 brightnessContrast( vec3 color, float brightness, float contrast ) {
    return ( color - 0.5 ) * contrast + 0.5 + brightness;
}

vec4 brightnessContrast( vec4 color, float brightness, float contrast ) {
    return vec4(brightnessContrast(color.rgb, brightness, contrast), color.a);
}

void main() {
    vec4 color = texture(uColor, vUv);
    vec3 bloom = texture(uBloom, vUv).rgb;
    bloom = rgb2hsv(bloom);
    bloom.g = 0.5;
    bloom = hsv2rgb(bloom);

    color.rgb += bloom * 0.2;

    float vignette = smoothstep(0.6, 1., length(vUv * 2. - 1.) * 0.8);
    vec3 vignetteOverlay = 1. - vec3(1., .8, .5) * vignette;
    vignetteOverlay = vignetteOverlay * 0.4 + 0.6;
    color.rgb *= vignetteOverlay;

    outColor = LinearTosRGB(color);
}
