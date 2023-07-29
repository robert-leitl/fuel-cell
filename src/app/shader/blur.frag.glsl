uniform sampler2D uColor;
uniform vec2 uDirection;

layout(location = 0) out vec4 outColor;

in vec2 vUv;

vec4 gaussianBlur1D_fast9(in sampler2D tex, in vec2 st, in vec2 offset) {
    vec4 color = vec4(0.);
    vec2 off1 = vec2(1.3846153846) * offset;
    vec2 off2 = vec2(3.2307692308) * offset;
    color += texture(tex, st) * .2270270270;
    color += texture(tex, st + (off1)) * .3162162162;
    color += texture(tex, st - (off1)) * .3162162162;
    color += texture(tex, st + (off2)) * .0702702703;
    color += texture(tex, st - (off2)) * .0702702703;
    return color;
}

vec4 gaussianBlur1D_fast13(in sampler2D tex, in vec2 st, in vec2 offset) {
    vec4 color = vec4(0.);
    vec2 off1 = vec2(1.411764705882353) * offset;
    vec2 off2 = vec2(3.2941176470588234) * offset;
    vec2 off3 = vec2(5.176470588235294) * offset;
    color += texture(tex, st) * .1964825501511404;
    color += texture(tex, st + (off1)) * .2969069646728344;
    color += texture(tex, st - (off1)) * .2969069646728344;
    color += texture(tex, st + (off2)) * .09447039785044732;
    color += texture(tex, st - (off2)) * .09447039785044732;
    color += texture(tex, st + (off3)) * .010381362401148057;
    color += texture(tex, st - (off3)) * .010381362401148057;
    return color;
}

void main() {
    vec2 texelSize = 1. / vec2(textureSize(uColor, 0));
    outColor = gaussianBlur1D_fast13(uColor, vUv, texelSize * uDirection);
}
