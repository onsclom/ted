precision mediump float;
uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_time;
varying vec2 v_texCoord;

#define DURATION 10.0
#define AMT 0.1

#define SS(a, b, x) (smoothstep(a, b, x) * smoothstep(b, a, x))

// Hash function rewritten for GLSL ES 1.0
vec3 hash33(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p * (p * 0.1 + 0.1));
}

// Gradient noise by iq
float gnoise(vec3 x) {
    vec3 p = floor(x);
    vec3 w = fract(x);

    vec3 u = w * w * w * (w * (w * 6.0 - 15.0) + 10.0);

    vec3 ga = hash33(p + vec3(0.0, 0.0, 0.0));
    vec3 gb = hash33(p + vec3(1.0, 0.0, 0.0));
    vec3 gc = hash33(p + vec3(0.0, 1.0, 0.0));
    vec3 gd = hash33(p + vec3(1.0, 1.0, 0.0));
    vec3 ge = hash33(p + vec3(0.0, 0.0, 1.0));
    vec3 gf = hash33(p + vec3(1.0, 0.0, 1.0));
    vec3 gg = hash33(p + vec3(0.0, 1.0, 1.0));
    vec3 gh = hash33(p + vec3(1.0, 1.0, 1.0));

    float va = dot(ga, w - vec3(0.0, 0.0, 0.0));
    float vb = dot(gb, w - vec3(1.0, 0.0, 0.0));
    float vc = dot(gc, w - vec3(0.0, 1.0, 0.0));
    float vd = dot(gd, w - vec3(1.0, 1.0, 0.0));
    float ve = dot(ge, w - vec3(0.0, 0.0, 1.0));
    float vf = dot(gf, w - vec3(1.0, 0.0, 1.0));
    float vg = dot(gg, w - vec3(0.0, 1.0, 1.0));
    float vh = dot(gh, w - vec3(1.0, 1.0, 1.0));

    float gNoise = va +
            u.x * (vb - va) +
            u.y * (vc - va) +
            u.z * (ve - va) +
            u.x * u.y * (va - vb - vc + vd) +
            u.y * u.z * (va - vc - ve + vg) +
            u.z * u.x * (va - vb - ve + vf) +
            u.x * u.y * u.z * (-va + vb + vc - vd + ve - vf - vg + vh);

    return 2.0 * gNoise;
}

// Warp UVs for the CRT effect
vec2 crt(vec2 uv) {
    float tht = atan(uv.y, uv.x);
    float r = length(uv);
    r /= (1.0 - 0.1 * r * r);
    uv.x = r * cos(tht);
    uv.y = r * sin(tht);
    return 0.5 * (uv + 1.0);
}

void main() {
    vec2 fragCoord = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y);
    vec2 uv = fragCoord / u_resolution;
    float t = u_time;

    float glitchAmount = SS(DURATION * 0.001, DURATION * AMT, mod(t, DURATION));
    float displayNoise = 0.0;
    vec3 col = vec3(0.0);
    vec2 eps = vec2(5.0 / u_resolution.x, 0.0);
    vec2 st = vec2(0.0);

    float y = uv.y * u_resolution.y;
    float distortion = gnoise(vec3(0.0, y * 0.01, t * 500.0)) * (glitchAmount * 4.0 + 0.1);
    distortion *= gnoise(vec3(0.0, y * 0.02, t * 250.0)) * (glitchAmount * 2.0 + 0.025);

    distortion += smoothstep(0.999, 1.0, sin((uv.y + t * 1.6) * 2.0)) * 0.02;
    distortion -= smoothstep(0.999, 1.0, sin((uv.y + t) * 2.0)) * 0.02;
    st = uv + vec2(distortion, 0.0);

    col.r += texture2D(u_texture, st + eps + distortion).r;
    col.g += texture2D(u_texture, st).g;
    col.b += texture2D(u_texture, st - eps - distortion).b;

    displayNoise = 0.2 * clamp(displayNoise, 0.0, 1.0);
    col += (0.15 + 0.65 * glitchAmount) * (hash33(vec3(fragCoord, mod(t, 1000.0))).r) * displayNoise;
    col -= (0.25 + 0.75 * glitchAmount) * (sin(4.0 * t + uv.y * u_resolution.y * 1.75)) * displayNoise;

    gl_FragColor = vec4(col, 1.0);
}
