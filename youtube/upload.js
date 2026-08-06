const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, ".env.local") });

const SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.force-ssl",
];

const AD_DIR = path.join(__dirname, "..", "advertising");

const ADS = {
  "bloomora-intro": {
    video: path.join(AD_DIR, "bloomora-intro", "out", "bloomora-intro.mp4"),
    title: "Bloomora Labs — Learning tools, made simple.",
    description: `Three products, one mission: learning should be simple, accessible, and empowering.

TinyLearn 🎯 — focused learning, built around quality
NearBook 📚 — pre-loved books for NEET students
NeuroPrep 🧠 — a learning app that saves you from forgetfulness

Bloomora Labs → https://sahilhasnain.github.io/bloomora-labs/`,
    tags: ["Bloomora Labs", "EdTech", "Learning", "Startup", "Coming Soon"],
  },
  tinylearn: {
    video: path.join(AD_DIR, "tinylearn", "out", "tinylearn.mp4"),
    title: "TinyLearn — Your feed is full. Your focus isn't. 🎯",
    description: `Your feed is full. Your focus isn't.

TinyLearn keeps learning small and built around quality — one bite-sized lesson at a time. Curated, not endless. Made to stick.

Learn small. Retain more. Show up daily. 🎯

Join the waitlist → https://sahilhasnain.github.io/ai-learning/`,
    tags: ["TinyLearn", "Learning App", "Focused Learning", "Study Tips", "Bloomora Labs"],
  },
  nearbook: {
    video: path.join(AD_DIR, "nearbook", "out", "nearbook.mp4"),
    title: "NearBook — Good books shouldn't cost a fortune. 📚",
    description: `Good books shouldn't cost a fortune.

NearBook is where NEET students buy and sell pre-loved books — pay less, and earn back what you spend.

Save money. Earn back. Study better. 📚

Join the waitlist → https://sahilhasnain.github.io/nearbook/`,
    tags: ["NearBook", "NEET Prep", "Pre-loved Books", "Study Smart", "Bloomora Labs"],
  },
};

function getAuth() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Missing YouTube credentials. Check GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN in youtube/.env.local"
    );
  }

  const auth = new google.auth.OAuth2(clientId, clientSecret, "urn:ietf:wg:oauth:2.0:oob");
  auth.setCredentials({ refresh_token: refreshToken });
  return auth;
}

async function uploadWithThumbnail({ videoPath, title, description = "", tags = [], categoryId = "28", privacy = "unlisted", thumbPath = null }) {
  const auth = getAuth();
  const youtube = google.youtube({ version: "v3", auth });

  console.log(`\nUploading: ${title}`);
  console.log(`File: ${videoPath}`);

  const requestBody = {
    snippet: {
      title: title.slice(0, 100),
      description: description.slice(0, 5000),
      tags: tags.slice(0, 30),
      categoryId,
      defaultLanguage: "en",
    },
    status: {
      privacyStatus: privacy,
      selfDeclaredMadeForKids: false,
    },
  };

  const response = await youtube.videos.insert({
    part: ["snippet", "status"],
    requestBody,
    media: { body: fs.createReadStream(videoPath) },
  });

  const videoId = response.data.id;

  if (thumbPath && fs.existsSync(thumbPath)) {
    try {
      await youtube.thumbnails.set({
        videoId,
        media: { mimeType: "image/png", body: fs.createReadStream(thumbPath) },
      });
      console.log("✅ Thumbnail uploaded");
    } catch (err) {
      console.warn("⚠ Thumbnail upload failed:", err.message);
    }
  }

  const videoUrl = `https://youtu.be/${videoId}`;
  console.log(`\n✅ Uploaded: ${videoUrl}`);

  return { videoId, videoUrl };
}

async function getChannelInfo() {
  const auth = getAuth();
  const youtube = google.youtube({ version: "v3", auth });
  const response = await youtube.channels.list({ part: ["snippet", "statistics"], mine: true });
  return response.data.items[0];
}

module.exports = { uploadWithThumbnail, getChannelInfo, getAuth, ADS };

if (require.main === module) {
  const [ad, ...flags] = process.argv.slice(2);

  if (!ad || !ADS[ad]) {
    console.error(`Usage: node upload.js <ad> [--title ...] [--description ...] [--tags a,b,c] [--privacy public|unlisted|private] [--thumbnail path]\n`);
    console.error(`Available ads: ${Object.keys(ADS).join(", ")}`);
    process.exit(1);
  }

  const preset = ADS[ad];
  const getFlag = (name) => {
    const i = flags.indexOf(name);
    return i !== -1 ? flags[i + 1] : undefined;
  };

  const videoPath = getFlag("--video") || preset.video;
  if (!fs.existsSync(videoPath)) {
    console.error(`Video not found: ${videoPath}\nBuild it first with node render.mjs && python build.py in advertising/${ad}`);
    process.exit(1);
  }

  uploadWithThumbnail({
    videoPath,
    title: getFlag("--title") || preset.title,
    description: getFlag("--description") || preset.description,
    tags: (getFlag("--tags") || "").split(",").filter(Boolean).concat(preset.tags),
    privacy: getFlag("--privacy") || "unlisted",
    thumbPath: getFlag("--thumbnail"),
  })
    .then(({ videoUrl }) => console.log(`\nVideo ready: ${videoUrl}`))
    .catch((err) => {
      console.error("\n❌ Error:", err.message);
      process.exit(1);
    });
}
