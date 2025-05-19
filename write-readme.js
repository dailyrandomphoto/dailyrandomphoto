const { resolve } = require("path");
const dateFormat = require("dateformat");
const readFirstFile = require("read-first-file");
const fs = require("fs").promises;

// Configuration
const DATA_PATH = resolve(__dirname, "data", "" + new Date().getFullYear());
const README_PATH = resolve(__dirname, "README.md");
const ARCHIVE_PATH = resolve(__dirname, "archive.json");
const RSS_PATH = resolve(__dirname, "rss.xml");
const MAX_ARCHIVE_ENTRIES = 30;
const DATA_RETENTION_DAYS = 30;
const FEED_TITLE = "Daily Random Photo Archive";
const FEED_DESCRIPTION = "Archive of daily random photos";
const FEED_LINK = "https://www.dailyrandomphoto.com/archive";

// --- Utility Functions ---

function printReadme(date, photo) {
  const urlPath = dateFormat(date, "yyyy/yyyy-mm-dd");
  const contents = `# [Daily Random Photo](https://www.dailyrandomphoto.com/)

<div align="center">
  <br>
  <br>
  <a href="https://www.dailyrandomphoto.com/p/${urlPath}/"><img src="${photo.urls.regular}" width="600px"></a>
  <br>
  <br>
  <p class="has-text-grey">Photo by <a href="https://unsplash.com/@${photo.user.username}?utm_source=Daily%20Random%20Photo&amp;utm_medium=referral" target="_blank" rel="noopener noreferrer">${photo.user.name}</a> on <a href="${photo.links.html}?utm_source=Daily%20Random%20Photo&amp;utm_medium=referral" target="_blank" rel="noopener noreferrer">Unsplash</a></p>
</div>`;
  console.info(contents);
  return contents;
}

// --- Data Access Functions ---

async function readLatestPhotoData() {
  try {
    const latestFile = await readFirstFile(DATA_PATH, { compareFn: (a, b) => b.localeCompare(a) });
    if (latestFile && latestFile.content) {
      return JSON.parse(latestFile.content);
    } else {
      console.warn("No photo data found.");
      return null;
    }
  } catch (error) {
    console.error("Error reading latest photo data:", error);
    return null;
  }
}

async function readArchive() {
  try {
    const archiveContent = await fs.readFile(ARCHIVE_PATH, "utf-8");
    return JSON.parse(archiveContent);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.warn("Archive file not found.");
      return {};
    } else {
      console.error("Error reading archive file:", error);
      return {};
    }
  }
}

async function getArchivedPhotoByDate(dateString) {
  const archive = await readArchive();
  return archive[dateString] || null;
}

// --- Data Management Functions ---

async function saveReadme(content) {
  try {
    await fs.writeFile(README_PATH, content);
    console.info(`README.md saved successfully to ${README_PATH}`);
  } catch (error) {
    console.error("Error saving README.md:", error);
  }
}

async function archivePhotoData(photoData) {
  if (!photoData || !photoData.date || !photoData.photo) {
    console.warn("Invalid photo data for archiving.");
    return;
  }
  try {
    const archive = await readArchive();
    const dateKey = dateFormat(photoData.date, "yyyy-mm-dd");
    archive[dateKey] = {
      photoId: photoData.photo.id,
      user: { username: photoData.photo.user.username, name: photoData.photo.user.name },
      urls: { regular: photoData.photo.urls.regular },
      links: { html: photoData.photo.links.html },
    };
    await fs.writeFile(ARCHIVE_PATH, JSON.stringify(archive, null, 2));
    console.info(`Photo data for ${dateKey} archived successfully.`);
  } catch (error) {
    console.error("Error archiving photo data:", error);
  }
}

async function pruneArchive(maxEntries = MAX_ARCHIVE_ENTRIES) {
  try {
    const archive = await readArchive();
    const dates = Object.keys(archive).sort((a, b) => new Date(b) - new Date(a));
    if (dates.length > maxEntries) {
      const toRemove = dates.slice(maxEntries);
      toRemove.forEach(date => delete archive[date]);
      await fs.writeFile(ARCHIVE_PATH, JSON.stringify(archive, null, 2));
      console.info(`Archive pruned. Kept the latest ${maxEntries} entries.`);
    } else {
      console.info("Archive does not need pruning.");
    }
  } catch (error) {
    console.error("Error pruning archive:", error);
  }
}

async function cleanupOldData(maxAgeDays = DATA_RETENTION_DAYS) {
  const cutoffDate = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);
  try {
    const yearDirs = await fs.readdir(resolve(__dirname, "data"));
    for (const yearDir of yearDirs) {
      const yearDirPath = resolve(__dirname, "data", yearDir);
      const stats = await fs.stat(yearDirPath);
      if (stats.isDirectory() && /^\d{4}$/.test(yearDir)) {
        const files = await fs.readdir(yearDirPath);
        for (const file of files) {
          const filePath = resolve(yearDirPath, file);
          const fileStats = await fs.stat(filePath);
          if (fileStats.isFile() && fileStats.mtimeMs < cutoffDate) {
            await fs.unlink(filePath);
            console.info(`Deleted old data file: ${filePath}`);
          }
        }
        const remainingFiles = await fs.readdir(yearDirPath);
        if (remainingFiles.length === 0 && yearDir !== String(new Date().getFullYear())) {
          await fs.rmdir(yearDirPath);
          console.info(`Deleted empty old data directory: ${yearDirPath}`);
        }
      }
    }
    console.info(`Old data cleanup complete. Files older than ${maxAgeDays} days have been deleted.`);
  } catch (error) {
    console.error("Error during old data cleanup:", error);
  }
}

// --- Feed Generation ---

async function generateRSSFeed(
  feedTitle = FEED_TITLE,
  feedDescription = FEED_DESCRIPTION,
  feedLink = FEED_LINK
) {
  try {
    const archive = await readArchive();
    const sortedDates = Object.keys(archive).sort((a, b) => new Date(b) - new Date(a));

    let rssFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>${feedTitle}</title>
  <link>${feedLink}</link>
  <description>${feedDescription}</description>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
  <pubDate>${sortedDates.length > 0 ? new Date(sortedDates[0]).toUTCString() : new Date().toUTCString()}</pubDate>
  <ttl>1800</ttl>`;

    for (const date of sortedDates) {
      const entry = archive[date];
      const itemLink = `https://www.dailyrandomphoto.com/p/${dateFormat(date, "yyyy/yyyy-mm-dd")}/`;
      rssFeed += `
  <item>
    <title>Daily Random Photo - ${date}</title>
    <link>${itemLink}</link>
    <description><![CDATA[
      <img src="${entry.urls.regular}" width="600px"><br>
      Photo by <a href="https://unsplash.com/@${entry.user.username}?utm_source=Daily%20Random%20Photo&amp;utm_medium=referral" target="_blank" rel="noopener noreferrer">${entry.user.name}</a> on <a href="${entry.links.html}?utm_source=Daily%20Random%20Photo&amp;utm_medium=referral" target="_blank" rel="noopener noreferrer">Unsplash</a>
    ]]></description>
    <pubDate>${new Date(date).toUTCString()}</pubDate>
    <guid isPermaLink="true">${itemLink}</guid>
  </item>`;
    }

    rssFeed += `
</channel>
</rss>`;

    await fs.writeFile(RSS_PATH, rssFeed);
    console.info(`RSS feed generated successfully at ${RSS_PATH}`);

  } catch (error) {
    console.error("Error generating RSS feed:", error);
  }
}

// --- Main Execution ---

async function main() {
  await generateAndSaveReadme();
  await pruneArchive();
  await generateRSSFeed();
  await cleanupOldData();
}

async function generateAndSaveReadme() {
  const latestPhotoData = await readLatestPhotoData();
  if (latestPhotoData && latestPhotoData.photo && latestPhotoData.date) {
    const readmeContent = printReadme(latestPhotoData.date, latestPhotoData.photo);
    await saveReadme(readmeContent);
    await archivePhotoData(latestPhotoData);
  }
}

main();

// --- Optional Function Calls ---
// readArchive().then(data => console.log("Archive:", data));
// getArchivedPhotoByDate("2025-05-18").then(photo => console.log("Photo for date:", photo));
// pruneArchive(60);
// generateRSSFeed("My Awesome Photo Feed", "A collection of daily random photos", "https://example.com/feed");
// cleanupOldData(90);
 
