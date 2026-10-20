
export const DEFAULT_CLIENT_CONTEXT_TEMPLATE = {
  projectId: "",
  tool: "PINHOLE",
  userPaygateTier: "PAYGATE_TIER_TWO",
  sessionId: "",
  recaptchaContext: {
    token: "",
    applicationType: "RECAPTCHA_APPLICATION_TYPE_WEB"
  }
};

export const API_TEMPLATES = {
  IMAGE_2K: {
    endpoint: "https://aisandbox-pa.googleapis.com/v1/flow/upsampleImage",
    body: {
      mediaId: "",
      targetResolution: "UPSAMPLE_IMAGE_RESOLUTION_2K",
      clientContext: DEFAULT_CLIENT_CONTEXT_TEMPLATE
    }
  },
  IMAGE_4K: {
    endpoint: "https://aisandbox-pa.googleapis.com/v1/flow/upsampleImage",
    body: {
      mediaId: "",
      targetResolution: "UPSAMPLE_IMAGE_RESOLUTION_4K",
      clientContext: DEFAULT_CLIENT_CONTEXT_TEMPLATE
    }
  },
  VIDEO_1080P: {
    endpoint: "https://aisandbox-pa.googleapis.com/v1/video:batchAsyncGenerateVideoUpsampleVideo",
    body: {
      mediaGenerationContext: { batchId: "" },
      clientContext: DEFAULT_CLIENT_CONTEXT_TEMPLATE,
      requests: [{
        resolution: "VIDEO_RESOLUTION_1080P",
        aspectRatio: "VIDEO_ASPECT_RATIO_LANDSCAPE",
        seed: 1,
        videoModelKey: "veo_3_1_upsampler_1080p",
        metadata: { workflowId: "" },
        videoInput: { mediaId: "" }
      }],
      useV2ModelConfig: true
    }
  },
  GENERATE_VIDEO: {
    endpoint: "https://aisandbox-pa.googleapis.com/v1/video:generateVideo",
    body: {
      prompt: "",
      aspectRatio: "VIDEO_ASPECT_RATIO_LANDSCAPE",
      videoModelKey: "veo_1_0_gen_video_high_res",
      clientContext: DEFAULT_CLIENT_CONTEXT_TEMPLATE
    }
  },
  BATCH_GENERATE_IMAGES: {
    endpoint: "https://aisandbox-pa.googleapis.com/v1/flow/batchGenerateImages",
    body: {
      requests: [
        {
          prompt: "",
          aspectRatio: "IMAGE_ASPECT_RATIO_LANDSCAPE",
          imageModelKey: "imagen_4_0_gen_image_high_res"
        }
      ],
      clientContext: DEFAULT_CLIENT_CONTEXT_TEMPLATE
    }
  },
  STATUS: {
    endpoint: "https://aisandbox-pa.googleapis.com/v1/flow/generationStatus",
    body: {
      generationId: "",
      clientContext: DEFAULT_CLIENT_CONTEXT_TEMPLATE
    }
  }
};
