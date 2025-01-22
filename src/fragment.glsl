precision mediump float;
uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_time;
varying vec2 v_texCoord;

void main() {
    vec2 uv = v_texCoord;
    vec2 distortedUV = vec2(uv.x + sin(u_time * 3. + (uv.y * u_resolution.y) * .05) * u_resolution.x * .000002, 1.0 - uv.y);
    gl_FragColor = texture2D(u_texture, distortedUV);
}
