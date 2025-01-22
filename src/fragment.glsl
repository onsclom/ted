precision mediump float;
uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_time;
varying vec2 v_texCoord;

#define TAU 6.28318530718
#define MAX_ITER 6

void main() {
    // Define water color
    vec3 water_color = vec3(1.0, 1.0, 1.0) * 0.5;
    float time = u_time * 0.5 + 23.0;

    // Flip the Y-axis for WebGL texture coordinates
    vec2 fragCoord = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y);

    // Normalized coordinates
    vec2 uv = fragCoord.xy / u_resolution.xy;

    // Initialize variables for caustics calculation
    vec2 p = mod(uv * TAU, TAU) - 250.0;
    vec2 i = vec2(p);
    float c = 1.0;
    float inten = 0.005;

    // Compute caustics
    for (int n = 0; n < MAX_ITER; n++) {
        float t = time * (1.0 - (3.5 / float(n + 1)));
        i = p + vec2(
                    cos(t - i.x) + sin(t + i.y),
                    sin(t - i.y) + cos(t + i.x)
                );
        c += 1.0 / length(vec2(
                        p.x / (sin(i.x + t) / inten),
                        p.y / (cos(i.y + t) / inten)
                    ));
    }
    c /= float(MAX_ITER);
    c = 1.17 - pow(c, 1.4);

    // Calculate color and clamp
    vec3 color = vec3(pow(abs(c), 15.0));
    color = clamp((color + water_color) * 1.2, 0.0, 1.0);

    // Perturb UV based on value of c
    vec2 tc = vec2(cos(c) - 0.75, sin(c) - 0.75) * 0.04;
    uv = clamp(uv + tc, 0.0, 1.0);

    // Sample texture
    vec4 texColor = texture2D(u_texture, uv);

    // Assign color to transparent pixels
    if (texColor.a == 0.0) {
        texColor = vec4(1.0, 1.0, 1.0, 1.0);
    }

    // Multiply texture color by calculated color
    gl_FragColor = texColor * vec4(color, 1.0);
}
