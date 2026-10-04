import type { EnhancementMode } from '../types';
import type { Ionicons } from '@expo/vector-icons';
export const TOOLS: { id: EnhancementMode; label: string; description: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'auto', label: 'Enhance', description: 'A little clarity. A big difference.', icon: 'sparkles-outline' },
  { id: 'face_enhance', label: 'Portrait', description: 'Put the focus back on you.', icon: 'person-outline' },
  { id: 'photo_restore', label: 'Restore', description: 'Give your memories a fresh start.', icon: 'time-outline' },
  { id: 'sharpen', label: 'Unblur', description: 'Sharper edges. Softer noise.', icon: 'scan-outline' },
  { id: 'hd_upscale', label: 'Upscale', description: 'Make room for every detail.', icon: 'expand-outline' },
  { id: 'remove_bg', label: 'Cutout', description: 'Just you. No distractions.', icon: 'cut-outline' },
  { id: 'color_enhance', label: 'Color', description: 'Bring the color back.', icon: 'sunny-outline' },
];
export const toolName = (mode: EnhancementMode) => TOOLS.find(tool => tool.id === mode)?.label || 'Enhance';
