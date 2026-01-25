struct Uniforms {
  viewProjection: mat4x4<f32>,
  resolution: vec2<f32>,
  time: f32,
  focusedNodeIndex: i32,
}

struct NodeInstance {
  position: vec2<f32>,
  size: f32,
  nodeType: u32, // 0 = knowledge, 1 = rule, 2 = decision
  color: vec4<f32>,
  selected: u32,
  focused: u32,
  importance: f32,
  _padding: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> nodes: array<NodeInstance>;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) localPos: vec2<f32>,
  @location(1) color: vec4<f32>,
  @location(2) @interpolate(flat) nodeType: u32,
  @location(3) selected: f32,
  @location(4) focused: f32,
  @location(5) importance: f32,
}

// Quad vertices for instanced rendering
const QUAD_VERTICES = array<vec2<f32>, 6>(
  vec2<f32>(-1.0, -1.0),
  vec2<f32>(1.0, -1.0),
  vec2<f32>(1.0, 1.0),
  vec2<f32>(-1.0, -1.0),
  vec2<f32>(1.0, 1.0),
  vec2<f32>(-1.0, 1.0),
);

@vertex
fn vertexMain(
  @builtin(vertex_index) vertexIndex: u32,
  @builtin(instance_index) instanceIndex: u32
) -> VertexOutput {
  let node = nodes[instanceIndex];
  let quadVertex = QUAD_VERTICES[vertexIndex];

  // Scale quad by node size
  let scaledPos = quadVertex * node.size;

  // Apply node position
  let worldPos = vec4<f32>(node.position + scaledPos, 0.0, 1.0);

  // Apply view-projection
  let clipPos = uniforms.viewProjection * worldPos;

  var output: VertexOutput;
  output.position = clipPos;
  output.localPos = quadVertex;
  output.color = node.color;
  output.nodeType = node.nodeType;
  output.selected = f32(node.selected);
  output.focused = f32(node.focused);
  output.importance = node.importance;

  return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
  let dist = length(input.localPos);

  // Discard pixels outside the circle
  if (dist > 1.0) {
    discard;
  }

  var color = input.color;

  // Soft edge
  let edgeSoftness = 0.05;
  let alpha = 1.0 - smoothstep(1.0 - edgeSoftness, 1.0, dist);

  // Add glow effect for focused nodes
  if (input.focused > 0.5) {
    let glowIntensity = (1.0 - dist) * 0.5;
    color = color + vec4<f32>(0.3, 0.4, 0.8, 0.0) * glowIntensity;
  }

  // Add highlight ring for selected nodes
  if (input.selected > 0.5) {
    let ringWidth = 0.15;
    let ringDist = abs(dist - 0.85);
    if (ringDist < ringWidth) {
      let ringAlpha = 1.0 - (ringDist / ringWidth);
      color = mix(color, vec4<f32>(1.0, 1.0, 1.0, 1.0), ringAlpha * 0.8);
    }
  }

  // Different shapes based on node type
  if (input.nodeType == 1u) {
    // Rule nodes: diamond shape hint
    let diamondDist = abs(input.localPos.x) + abs(input.localPos.y);
    if (diamondDist > 1.2) {
      discard;
    }
  } else if (input.nodeType == 2u) {
    // Decision nodes: slightly squared
    let squaredDist = max(abs(input.localPos.x), abs(input.localPos.y));
    if (squaredDist > 0.9 && dist > 0.95) {
      discard;
    }
  }

  return vec4<f32>(color.rgb, color.a * alpha);
}
