/** NTE Tracker v1.1 — signed Tauri updater; app state stays in the OS data directory. */
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';

const $ = (id) => document.getElementById(id);
const checkButton = $('update-check');
const banner = $('update-banner');
const installButton = $('update-install');
const laterButton = $('update-later');
const title = $('update-title');
const notes = $('update-notes');
const status = $('update-status');
const track = $('update-track');
const progress = $('update-progress');
let pendingUpdate = null;
let checkBusy = false;
let installing = false;

function displayUpdate(update) {
  pendingUpdate = update;
  title.textContent = `Update available — v${update.version}`;
  notes.textContent = update.body || 'Bug fixes and improvements.';
  status.textContent = 'A verified update is ready to install.';
  installButton.disabled = false;
  laterButton.disabled = false;
  installButton.textContent = 'Update Now';
  progress.style.width = '0%';
  track.hidden = true;
  banner.hidden = false;
}

async function checkForUpdate(manual = false) {
  if (checkBusy || installing) return;
  checkBusy = true;
  checkButton.disabled = true;
  checkButton.textContent = '↻ Checking…';
  try {
    const result = await check({ timeout: 15000 });
    if (result) displayUpdate(result);
    else if (manual) {
      const version = await getVersion();
      banner.hidden = false;
      title.textContent = `Up to date — v${version}`;
      notes.textContent = 'No newer published version is available.';
      status.textContent = '';
      installButton.hidden = true;
      laterButton.disabled = false;
      pendingUpdate = null;
    }
    if (result) installButton.hidden = false;
  } catch (error) {
    console.warn('Update check failed:', error);
    if (manual) {
      banner.hidden = false;
      title.textContent = 'Unable to check for updates';
      notes.textContent = String(error);
      status.textContent = 'Your local tracker and SQLite data are unaffected.';
      installButton.hidden = true;
      pendingUpdate = null;
    }
  } finally {
    checkBusy = false;
    checkButton.disabled = false;
    checkButton.textContent = '↻ Check Updates';
  }
}

async function installUpdate() {
  if (!pendingUpdate || installing) return;
  installing = true;
  installButton.disabled = true;
  laterButton.disabled = true;
  checkButton.disabled = true;
  let received = 0;
  let total = null;
  status.textContent = 'Saving a pre-update backup…';
  try {
    // A failed or pending database save must prevent replacement of the executable.
    if (typeof window.nteBeforeUpdate !== 'function' || !await window.nteBeforeUpdate()) {
      throw new Error('Cannot update while a SQLite save has failed. Export a backup first.');
    }
    await invoke('backup_before_update');
    status.textContent = 'Downloading and verifying the signed installer…';
    track.hidden = false;
    progress.style.width = '0%';
    await pendingUpdate.downloadAndInstall((event) => {
      if (event.event === 'Started') total = event.data.contentLength || null;
      if (event.event === 'Progress') {
        received += event.data.chunkLength;
        if (total) {
          const percent = Math.min(100, Math.round(received / total * 100));
          progress.style.width = `${percent}%`;
          status.textContent = `Downloading update… ${percent}%`;
        } else status.textContent = `Downloaded ${(received / (1024 * 1024)).toFixed(1)} MB`;
      }
      if (event.event === 'Finished') {
        progress.style.width = '100%';
        status.textContent = 'Download complete. Installing update…';
      }
    });
    status.textContent = 'Update installed. Restarting NTE Tracker…';
    await relaunch();
  } catch (error) {
    console.error('Update installation failed:', error);
    status.textContent = `Update failed: ${String(error)}. Your data is unchanged.`;
    installButton.textContent = 'Retry Update';
    installButton.disabled = false;
    laterButton.disabled = false;
    checkButton.disabled = false;
  } finally {
    installing = false;
  }
}

checkButton.addEventListener('click', () => checkForUpdate(true));
installButton.addEventListener('click', installUpdate);
laterButton.addEventListener('click', () => { if (!installing) banner.hidden = true; });
// The tracker remains fully usable offline and when GitHub is unreachable.
if (isTauri()) window.setTimeout(() => checkForUpdate(false), 1800);
