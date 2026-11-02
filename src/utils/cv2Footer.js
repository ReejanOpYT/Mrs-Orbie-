import {
  AttachmentBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
} from 'discord.js';
import { fileURLToPath } from 'url';
import { BOT_NAME } from './config.js';

const FOOTER_FILE = fileURLToPath(new URL('../../assets/mrs-orbie-footer.gif', import.meta.url));

/**
 * Adds the single official Mrs Orbie footer GIF to every Components V2 response.
 * No avatar, banner, thumbnail, or other branding image is attached here.
 */
export function withFooter(container, extraFlags = 0) {
  const gallery = new MediaGalleryBuilder().addItems(
    new MediaGalleryItemBuilder()
      .setURL('attachment://mrs-orbie-footer.gif')
      .setDescription(`${BOT_NAME} • Cute Quest Assistant • Premium`),
  );
  container.addMediaGalleryComponents(gallery);

  return {
    components: [container],
    files: [new AttachmentBuilder(FOOTER_FILE, { name: 'mrs-orbie-footer.gif' })],
    flags: MessageFlags.IsComponentsV2 | extraFlags,
  };
}
