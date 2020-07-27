const { resolve } = require("path");
const dateFormat = require("dateformat");
const readFirstFile = require("read-first-file");
const DATA_PATH = resolve(__dirname, "../dailyrandomphoto-api/2020");

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

readFirstFile(DATA_PATH, {
  onFileContent: (filename, content) => {
    const photo = JSON.parse(content);
    // Console.log(photo);
    printReadme(photo.date, photo.photo);
  },
  compareFn: (a, b) => b.localeCompare(a)
});
