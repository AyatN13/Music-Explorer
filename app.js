const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const SpotifyWebApi = require('spotify-web-api-node');

dotenv.config();
const app = express();

// Spotify API setup
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
});

// Get Spotify access token
spotifyApi.clientCredentialsGrant().then(
  data => {
    spotifyApi.setAccessToken(data.body['access_token']);
    console.log('Spotify access token set!');
  },
  err => {
    console.error('Error getting Spotify access token:', err);
  }
);

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.use(express.static('public'));

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 30000, // Increase timeout to 30 seconds
})
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));


// MongoDB schema and model
const artistSchema = new mongoose.Schema({
  name: String,
  topTracks: [String],
  albums: [String],
});

const Artist = mongoose.model('Artist', artistSchema);

// Routes
app.get('/', (req, res) => res.render('index'));

app.post('/search', async (req, res) => {
  const artistName = req.body.artistName;

  try {
    // Search for artist
    const artistData = await spotifyApi.searchArtists(artistName);
    const artist = artistData.body.artists.items[0];

    if (!artist) {
      return res.status(404).send('<h1>Artist not found</h1><a href="/">Go Back</a>');
    }

    // Get top tracks
    const topTracksData = await spotifyApi.getArtistTopTracks(artist.id, 'US');
    const topTracks = topTracksData.body.tracks.map(track => track.name);

    // Get albums
    const albumsData = await spotifyApi.getArtistAlbums(artist.id);
    const albums = albumsData.body.items.map(album => album.name);

    res.render('artist', { artist: { name: artist.name, topTracks, albums } });
  } catch (error) {
    console.error('Error fetching artist data:', error);
    res.status(500).send('<h1>Internal Server Error</h1><a href="/">Go Back</a>');
  }
});

app.get('/favorites', async (req, res) => {
  try {
    const favorites = await Artist.find();
    res.render('favorites', { favorites });
  } catch (error) {
    console.error('Error fetching favorite artists:', error);
    res.status(500).send('<h1>Error fetching favorite artists</h1><a href="/">Go Back</a>');
  }
});


app.post('/favorites', async (req, res) => {
  const { artistName, topTracks, albums } = req.body;

  const newArtist = new Artist({
    name: artistName,
    topTracks: topTracks.split(','), // Convert string to array
    albums: albums.split(','), // Convert string to array
  });

  try {
    // Check if artist already exists
    const existingArtist = await Artist.findOne({ name: artistName });
    if (existingArtist) {
      return res.status(409).send('<h1>Artist already in favorites</h1><a href="/favorites">View Favorites</a>');
    }

    await newArtist.save();
    res.redirect('/favorites');
  } catch (error) {
    console.error('Error saving favorite artist:', error);
    res.status(500).send('<h1>Error saving favorite artist</h1><a href="/">Go Back</a>');
  }
});


// Start the server
app.listen(process.env.PORT || 3000, () => {
  console.log(`Server running on port ${process.env.PORT || 3000}`);
});
