struct Uniforms {
  viewProjection: mat4x4<f32>,
  resolution: vec2<f32>,
  time: f32,
  _padding: f32,
}

struct EdgeInstance {
  startPos: vec2<f32>,
  endPos: vec2<f32>,
  color: vec4<f32>,
  width: f32,
  strength: f32,
  edgeType: u32, // 0=link, 1=reference, 2=contradiction, 3=supports, 4=derived
  _padding: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> edges: array<EdgeInstance>;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
  @location(1) color: vec4<f32>,
  @location(2) @interpolate(flat) edgeType: u32,
  @location(3) strength: f32,
}

// Line segment as quad
const LINE_VERTICES = array<vec2<f32>, 6>(
  vec2<f32>(0.0, -0.5),
  vec2<f32>(1.0, -0.5),
  vec2<f32>(1.0, 0.5),
  vec2<f32>(0.0, -0.5),
  vec2<f32>(1.0, 0.5),
  vec2<f32>(0.0, 0.5),
);

@vertex
fn vertexMain(
  @builtin(vertex_index) vertexIndex: u32,
  @builtin(instance_index) instanceIndex: u32
) -> VertexOutput {
  let edge = edges[instanceIndex];
  let vertex = LINE_VERTICES[vertexIndex];

  // Calculate line direction and perpendicular
  let dir = edge.endPos - edge.startPos;
  let length = length(dir);
  let normalized = dir / max(length, 0.001);
  let perpendicular = vec2<f32>(-normalized.y, normalized.x);

  // Build position along the line segment
  let worldPos = edge.startPos +
                 normalized * vertex.x * length +
                 perpendicular * vertex.y * edge.width;

  let clipPos = uniforms.viewProjection * vec4<f32>(worldPos, 0.0, 1.0);

  var output: VertexOutput;
  output.position = clipPos;
  output.uv = vertex;
  output.color = edge.color;
  output.edgeType = edge.edgeType;
  output.strength = edge.strength;

  return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
  var color = input.color;

  // Fade edges at the ends
  let endFade = smoothstep(0.0, 0.05, input.uv.x) * smoothstep(1.0, 0.95, input.uv.x);

  // Anti-aliased edge
  let edgeAlpha = 1.0 - smoothstep(0.3, 0.5, abs(input.uv.y));

  // Apply strength as opacity
  let finalAlpha = color.a * endFade * edgeAlpha * input.strength;

  // Different styles based on edge type
  if (input.edgeType == 2u) {
    // Contradiction: dashed red
    let dashPattern = step(0.5, fract(input.uv.x * 10.0));
    color = vec4<f32>(0.9, 0.3, 0.3, color.a * dashPattern);
  } else if (input.edgeType == 3u) {
    // Supports: thicker green
    color = vec4<f32>(0.3, 0.8, 0.4, color.a);
  }

  return vec4<f32>(color.rgb, finalAlpha);
}
