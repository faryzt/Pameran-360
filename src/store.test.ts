import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INITIAL_ARTWORKS,
  REPOSITORY_OTHER_ARTWORKS,
  getRepositoryList,
  resolveGalleryArtwork,
  ROOM_LIST,
  ROOMS,
  normalizeRoomId,
  formatIDR,
  formatLevelLabel,
  shortPinTitle,
  buildWhatsAppUrl,
  sphericalToCartesian,
  validateArtworkInput,
  calculateCartTotals,
  getArtworkComments,
  validateCommentInput,
  shortestAngleDeltaDeg,
  getAdjacentArtworkInRoom,
  findSmartArtworkSlot,
  DEFAULT_WHATSAPP_NUMBER,
  getDefaultArtworkImageUrl,
  resolveArtworkImageUrl,
  isCustomArtworkImage,
  getCuratorExpertComment,
  galleryStore,
} from './store.ts';
import {
  ROOM_AUDIO_PROFILES,
  getRoomAudioProfile,
} from './audioManager.ts';

test('ROOM_LIST contains 5 interconnected gallery rooms with 1-2 word portal labels and no Karya SD text', () => {
  assert.equal(ROOM_LIST.length, 5);
  assert.equal(ROOMS.ruang_1.panoramaUrl, '/assets/aistudio/ruang1_gerbang_sd_360.jpg');
  assert.equal(ROOMS.ruang_2.panoramaUrl, '/assets/aistudio/ruang2_lukisan_sd_360.jpg');
  assert.equal(ROOMS.ruang_3.panoramaUrl, '/assets/aistudio/ruang3_kriya_sd_360.jpg');
  assert.equal(ROOMS.ruang_4.panoramaUrl, '/assets/aistudio/ruang4_wastra_360.jpg');
  assert.equal(ROOMS.ruang_5.panoramaUrl, '/assets/aistudio/ruang5_repositori_360.jpg');
  for (const room of ROOM_LIST) {
    assert.ok(!room.name.toLowerCase().includes('karya sd'));
    assert.ok(room.portals.length >= 2);
    for (const portal of room.portals) {
      const words = portal.shortLabel.trim().split(/\s+/);
      assert.ok(words.length >= 1 && words.length <= 2, `Portal label "${portal.shortLabel}" should be 1-2 words`);
    }
    assert.equal(typeof room.repositoryYawDeg, 'number');
    assert.equal(typeof room.repositoryPitchDeg, 'number');
  }
  assert.equal(normalizeRoomId('foyer'), 'ruang_1');
  assert.equal(normalizeRoomId('interior'), 'ruang_2');
  assert.equal(normalizeRoomId('ruang_5'), 'ruang_5');
});

test('shortPinTitle returns concise 1-2 word hotspot titles for all artworks', () => {
  for (const art of INITIAL_ARTWORKS) {
    const shortName = shortPinTitle(art);
    const wordCount = shortName.trim().split(/\s+/).length;
    assert.ok(wordCount >= 1 && wordCount <= 2, `Expected 1-2 words for ${art.id}, got "${shortName}"`);
    assert.ok(!shortName.toLowerCase().includes('karya sd'));
  }
});

test('ROOM_AUDIO_PROFILES defines distinct ambient Gamelan and room tone profiles for all 5 rooms', () => {
  assert.equal(Object.keys(ROOM_AUDIO_PROFILES).length, 5);
  const p1 = getRoomAudioProfile('ruang_1');
  const p2 = getRoomAudioProfile('ruang_2');
  const p5 = getRoomAudioProfile('ruang_5');
  assert.notEqual(p1.baseDroneHz, p2.baseDroneHz);
  assert.notEqual(p2.baseDroneHz, p5.baseDroneHz);
  assert.ok(p1.scaleHz.length >= 5);
  assert.ok(p2.title.length > 5);
});

test('INITIAL_ARTWORKS contains 18 student artworks, each with a dedicated hyper-realistic photograph imageUrl', () => {
  assert.equal(INITIAL_ARTWORKS.length, 18);
  const imageUrls = new Set<string>();
  for (const art of INITIAL_ARTWORKS) {
    assert.equal(art.level, 'SD');
    assert.ok(art.school.startsWith('SD'));
    assert.ok(
      art.imageUrl && art.imageUrl.startsWith('/assets/artworks/art-'),
      `Expected ${art.id} to have hyper-realistic imageUrl, got ${art.imageUrl}`,
    );
    imageUrls.add(art.imageUrl!);
  }
  assert.equal(imageUrls.size, 18, 'Each of the 18 artworks must have a unique generated photograph');
  assert.equal(formatLevelLabel('SD'), 'SD');
  assert.equal(formatLevelLabel('ALL'), 'SD');

  const titles = new Set(INITIAL_ARTWORKS.map((a) => a.title));
  assert.ok(titles.has('Harmoni Gajah & Flora Way Kambas'));
  assert.ok(titles.has('Tari Topeng & Semarak Pamekasan'));
  assert.ok(titles.has('Ukiran Tameng Klabang Dayak Cilik'));
  assert.ok(titles.has('Penyu Hijau & Terumbu Karang Bunaken'));
});

test('Galeri (getRepositoryList & resolveGalleryArtwork) returns items and resolves any item with a real hyper-realistic imageUrl', () => {
  assert.ok(REPOSITORY_OTHER_ARTWORKS.length >= 12);
  const fullRepo = getRepositoryList(INITIAL_ARTWORKS);
  assert.equal(
    fullRepo.length,
    REPOSITORY_OTHER_ARTWORKS.length + INITIAL_ARTWORKS.length,
  );
  for (const art of INITIAL_ARTWORKS) {
    assert.equal(art.whatsapp, '6285111581115');
    assert.equal(isCustomArtworkImage(art), false, `Default artwork ${art.id} must not be marked as custom image`);
  }
  for (const item of fullRepo) {
    assert.ok(item.title.length > 2);
    assert.ok(item.kind.length > 2);
    assert.ok(!item.kind.includes('SD'));
    assert.ok(item.creator.length > 2);
    assert.ok(
      item.linkUrl.startsWith('https://wa.me/6285111581115?text='),
      `Expected ${item.id} linkUrl to use 6285111581115, got ${item.linkUrl}`,
    );
    const resolved = resolveGalleryArtwork(item.id, INITIAL_ARTWORKS);
    assert.ok(resolved, `Expected resolveGalleryArtwork to resolve ${item.id}`);
    assert.equal(resolved.title, item.title);
    assert.equal(resolved.whatsapp, '6285111581115');
    assert.ok(
      resolved.imageUrl && resolved.imageUrl.startsWith('/assets/artworks/'),
      `Expected resolved repository item ${item.id} to have real photograph imageUrl`,
    );
  }
});

test('shortestAngleDeltaDeg, getAdjacentArtworkInRoom, and findSmartArtworkSlot work accurately for smooth 360 transitions and smart admin placement', () => {
  // Shortest angular path across +-180 seam
  assert.equal(shortestAngleDeltaDeg(170, -170), 20);
  assert.equal(shortestAngleDeltaDeg(-170, 170), -20);
  assert.equal(shortestAngleDeltaDeg(-45, 45), 90);

  // Adjacent artwork navigation in room
  const art1Room = INITIAL_ARTWORKS[0].room;
  const nextFromArt1 = getAdjacentArtworkInRoom(INITIAL_ARTWORKS, 'art-1', 1);
  const prevFromArt1 = getAdjacentArtworkInRoom(INITIAL_ARTWORKS, 'art-1', -1);
  assert.ok(nextFromArt1 && nextFromArt1.room === art1Room);
  assert.ok(prevFromArt1 && prevFromArt1.room === art1Room);
  assert.notEqual(nextFromArt1.id, 'art-1');

  // Smart slot finder picks a valid yaw/pitch
  const smartWall = findSmartArtworkSlot(INITIAL_ARTWORKS, 'ruang_1', 'Dinding');
  assert.ok(smartWall.yaw >= -180 && smartWall.yaw <= 180);
  assert.equal(smartWall.pitch, 1);
  const smartRack = findSmartArtworkSlot(INITIAL_ARTWORKS, 'ruang_3', 'Rak Display');
  assert.equal(smartRack.pitch, -16);
});

test('formatIDR formats Indonesian Rupiah accurately with dot separators', () => {
  assert.equal(formatIDR(450000), 'Rp 450.000');
  assert.equal(formatIDR(1450000), 'Rp 1.450.000');
  assert.equal(formatIDR(0), 'Rp 0');
});

test('sphericalToCartesian maps yaw=0, pitch=0 to forward -Z axis', () => {
  const pos = sphericalToCartesian(0, 0, 10);
  assert.ok(Math.abs(pos.x - 0) < 1e-6);
  assert.ok(Math.abs(pos.y - 0) < 1e-6);
  assert.ok(Math.abs(pos.z - -10) < 1e-6);
});

test('validateArtworkInput rejects empty or invalid inputs and accepts valid artwork data', () => {
  const invalid = validateArtworkInput({
    title: 'A',
    creator: '',
    school: '',
    region: '',
    price: 0,
    yaw: 200,
    pitch: -60,
  });
  assert.equal(invalid.valid, false);
  assert.equal(invalid.errors.length, 7);

  const valid = validateArtworkInput(INITIAL_ARTWORKS[0]);
  assert.equal(valid.valid, true);
  assert.equal(valid.errors.length, 0);
});

test('galleryStore cart, Galeri modal, comments deletion, adminPasscode (123456 changeable), and audio controls work deterministically', () => {
  assert.equal(galleryStore.getState().hudCollapsed, true);
  assert.equal(galleryStore.getState().isRepositoryOpen, false);
  assert.equal(galleryStore.getState().adminPasscode, '123456');

  galleryStore.getState().setAdminPasscode('654321');
  assert.equal(galleryStore.getState().adminPasscode, '654321');
  galleryStore.getState().setAdminPasscode('123456');
  assert.equal(galleryStore.getState().adminPasscode, '123456');

  galleryStore.getState().setRepositoryOpen(true);
  assert.equal(galleryStore.getState().isRepositoryOpen, true);
  galleryStore.getState().setRepositoryOpen(false);
  assert.equal(galleryStore.getState().isRepositoryOpen, false);

  galleryStore.getState().clearCart();
  galleryStore.getState().addToCart(INITIAL_ARTWORKS[0]);
  galleryStore.getState().addToCart(INITIAL_ARTWORKS[0]);
  galleryStore.getState().addToCart(INITIAL_ARTWORKS[2]);

  const totals = calculateCartTotals(galleryStore.getState().cart);
  assert.equal(totals.totalItems, 3);
  assert.equal(
    totals.totalPrice,
    INITIAL_ARTWORKS[0].price * 2 + INITIAL_ARTWORKS[2].price,
  );

  assert.equal(DEFAULT_WHATSAPP_NUMBER, '6285111581115');
  const waUrl = buildWhatsAppUrl(INITIAL_ARTWORKS[0]);
  assert.ok(waUrl.startsWith('https://wa.me/6285111581115?text='));
  assert.ok(decodeURIComponent(waUrl).includes('Pameran Virtual'));

  assert.equal(validateCommentInput('A', 'Halo').valid, false);
  assert.equal(validateCommentInput('Budi', 'OK').valid, false);
  assert.equal(validateCommentInput('Budi Santoso', 'Karya luar biasa!').valid, true);

  const initialComments = getArtworkComments(
    galleryStore.getState().commentsByArtwork,
    'art-1',
  );
  assert.ok(initialComments.length >= 1);
  const curatorComment = initialComments.find((c) => c.visitorName === 'Tim Kurator Pameran Virtual');
  assert.ok(curatorComment, 'Expected Tim Kurator Pameran Virtual comment to exist');
  assert.equal(curatorComment.message, getCuratorExpertComment(INITIAL_ARTWORKS[0]));
  assert.ok(
    curatorComment.message.includes('Way Kambas') && curatorComment.message.includes('falsafah masyarakat Lampung'),
    'Expected authoritative budayawan curatorial commentary',
  );

  // Also verify repository artwork has budayawan comment
  const repoComments = getArtworkComments(
    galleryStore.getState().commentsByArtwork,
    'art-repo-1',
  );
  assert.ok(repoComments.length >= 1);
  assert.equal(repoComments[0].visitorName, 'Tim Kurator Pameran Virtual');
  assert.ok(repoComments[0].message.includes('Sriwijaya') && repoComments[0].message.includes('Sungai Musi'));

  const added = galleryStore.getState().addArtworkComment('art-1', {
    visitorName: 'Siti Rahma',
    message: 'Sangat inspiratif lukisan gajah Way Kambas ini!',
  });
  assert.equal(added.visitorName, 'Siti Rahma');
  const updatedComments = getArtworkComments(
    galleryStore.getState().commentsByArtwork,
    'art-1',
  );
  assert.equal(updatedComments[0].message, 'Sangat inspiratif lukisan gajah Way Kambas ini!');

  galleryStore.getState().deleteArtworkComment('art-1', added.id);
  const afterDelete = getArtworkComments(
    galleryStore.getState().commentsByArtwork,
    'art-1',
  );
  assert.ok(!afterDelete.some((c) => c.id === added.id));

  galleryStore.getState().setAudioVolume(45);
  assert.equal(galleryStore.getState().audioVolume, 45);
  assert.equal(galleryStore.getState().audioMuted, false);

  galleryStore.getState().setAudioVolume(0);
  assert.equal(galleryStore.getState().audioVolume, 0);
  assert.equal(galleryStore.getState().audioMuted, true);

  galleryStore.getState().setAudioVolume(70);
  assert.equal(galleryStore.getState().audioVolume, 70);
  assert.equal(galleryStore.getState().audioMuted, false);

  // Verify custom image upload (imageUrl) and reset logic restores canonical default photo
  const sampleDataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/';
  galleryStore.getState().updateArtwork('art-1', { imageUrl: sampleDataUrl });
  const updatedArt1 = galleryStore.getState().artworks.find((a) => a.id === 'art-1')!;
  assert.equal(updatedArt1.imageUrl, sampleDataUrl);
  assert.equal(isCustomArtworkImage(updatedArt1), true);

  // Resetting imageUrl via updateArtwork('art-1', { imageUrl: undefined }) restores canonical /assets/artworks/art-1.jpg
  galleryStore.getState().updateArtwork('art-1', { imageUrl: undefined });
  const resetArt1 = galleryStore.getState().artworks.find((a) => a.id === 'art-1')!;
  assert.equal(resetArt1.imageUrl, '/assets/artworks/art-1.jpg');
  assert.equal(isCustomArtworkImage(resetArt1), false);
  assert.equal(resolveArtworkImageUrl(undefined, resetArt1), getDefaultArtworkImageUrl(resetArt1));

  galleryStore.getState().resetSeedData();
  const restoredArt1 = galleryStore.getState().artworks.find((a) => a.id === 'art-1');
  assert.equal(restoredArt1?.imageUrl, '/assets/artworks/art-1.jpg');
});



