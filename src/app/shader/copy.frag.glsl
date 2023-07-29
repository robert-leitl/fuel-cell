uniform sampler2D uTexture;
uniform vec2 uResolution;

layout(location = 0) out vec4 outColor;

in vec2 vUv;

vec2 objectFitCover(vec2 uv, vec2 viewportSize, vec2 objectSize) {
    vec2 st = uv * 2. - 1.;
    float objectAspect = objectSize.x / objectSize.y;
    float viewportAspect = viewportSize.x / viewportSize.y;

    float scaleX = 1., scaleY = 1.;
    float textureFrameRatio = objectAspect / viewportAspect;
    bool portraitTexture = objectAspect < 1.;
    bool portraitFrame = viewportAspect < 1.;

    if(portraitFrame) {
        if (objectAspect < viewportAspect) {
            scaleY = textureFrameRatio;
        } else {
            scaleX = 1. / textureFrameRatio;
        }
    } else {
        if (objectAspect > viewportAspect) {
            scaleX = 1. / textureFrameRatio;
        } else {
            scaleY = textureFrameRatio;
        }
    }

    st *= vec2(scaleX, scaleY);
    st = st * 0.5 + 0.5;
    return st;
}

void main() {
    vec2 texSize = vec2(textureSize(uTexture, 0));
    vec2 st = objectFitCover(vUv, uResolution, texSize);

    outColor = texture(uTexture, st);
    outColor.a = 1.;
    #ifdef FINAL
        outColor = LinearTosRGB(outColor);
    #endif
}
