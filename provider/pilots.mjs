const nightFlash = [
  'Relight this exact photograph with hard on-camera flash and deep ambient blacks.',
  'Keep the same person, facial geometry, head angle, eye direction, expression, pose, clothing, crop and background.',
  'Change only lighting, color and subtle 35mm grain. Preserve natural skin texture.',
].join(' ');

const video = {
  prompt: 'Hold the subject, wardrobe and setting of the reference. A slow, steady camera move with natural motion.',
  duration_seconds: 5,
  resolution: '720p',
  generate_audio: false,
};

// One-photo pilot inputs based on the model routes used by PV LAB.
export const PILOTS = {
  'night-flash': {
    model: 'bytedance/seedream-5.0-pro/edit',
    imageField: 'image_urls',
    multiple: true,
    input: {prompt: nightFlash, resolution: '1k', aspect_ratio: 'auto', output_format: 'png', enable_thinking: true},
  },
  'seedream-flash': {
    model: 'bytedance/seedream-5.0-flash/edit',
    imageField: 'image_urls',
    multiple: true,
    input: {prompt: nightFlash, resolution: '1k', aspect_ratio: 'auto', output_format: 'png'},
  },
  'pv-still': {
    model: 'bytedance/seedream-5.0-lite/edit',
    imageField: 'image_urls',
    multiple: true,
    input: {prompt: nightFlash, size: '1600*2848', output_format: 'png'},
  },
  'qwen-image-3': {
    model: 'alibaba/qwen-image-3.0/edit',
    imageField: 'image_urls',
    multiple: true,
    input: {prompt: nightFlash, resolution: '1k', aspect_ratio: '9:16', num_outputs: 1, enable_prompt_expansion: false},
  },
  'wan-3': {
    model: 'alibaba/wan-3.0/reference-to-video',
    imageField: 'reference_image_urls',
    multiple: true,
    input: {...video, aspect_ratio: 'adaptive', enable_prompt_expansion: false},
  },
  'seedance-25': {
    model: 'bytedance/seedance-2.5/image-to-video',
    imageField: 'image_url',
    input: {...video, aspect_ratio: 'adaptive'},
  },
  'seedance-15-pro': {
    model: 'bytedance/seedance-1.5-pro/image-to-video',
    imageField: 'image_url',
    input: {...video, aspect_ratio: '16:9', camera_fixed: false},
  },
  'seedance-25-spicy': {
    model: 'bytedance/seedance-2.5-spicy/image-to-video',
    imageField: 'image_url',
    input: {...video, resolution: '4k'},
  },
  'kling-3-video': {
    model: 'kling/3.0/image-to-video',
    imageField: 'image_url',
    input: {...video, resolution: '1080p', shot_type: 'single', guidance_scale: 0.5},
  },
};

export function pilotRequest(preset, fileUri) {
  if (!Object.hasOwn(PILOTS, preset)) throw new Error('Unknown Synthkiss pilot preset.');
  const {model, imageField, multiple, input} = PILOTS[preset];
  return {model, input: {...input, [imageField]: multiple ? [fileUri] : fileUri}};
}
