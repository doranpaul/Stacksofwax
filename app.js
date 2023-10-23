const express = require("express"); 
const app = express(); 
const path = require('path');
const connection = require("./connection.js");
const bodyParser = require("body-parser");
const cookieParser = require('cookie-parser');
const session = require('express-session');


app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.urlencoded({extended: true}));

app.use(express.static(path.join(__dirname, './public')));

app.use(session({
  secret: "my secret",
  resave: false,
  saveUninitialized: false
}));

app.get("/index",(req, res) => { 
  res.render('index');
});


app.get("/uploadrecords", (req,res) =>{
  res.render('uploadrecords')
});

app.post("/uploadrecords", (req, res) => { 
  console.log(req.body);
  let recData = req.body;
  let artist = req.body.artist;
  let album_name = req.body.album_name;
  let genre = req.body.genre;
  let record_label = req.body.record_label;
  let release_date = req.body.release_date;
  let desc = req.body.description;
  let image = req.body.image_url;
  let tracklist = req.body.tracklist;
  let rating = req.body.rating;

  let artistQuery = `SELECT artist_id FROM artist WHERE artist_name = ?`;

  connection.query(artistQuery, [artist], (err, result) => {
    if (err) throw err;

    if (result.length === 0) {
      // Artist doesn't exist in the database, so add a new row to the artist table
      let insertArtistQuery = `INSERT INTO artist (artist_name) VALUES (?)`;

      connection.query(insertArtistQuery, [artist], (err, result) => {
        if (err) throw err;

        console.log(`New artist '${artist}' added to the artist table`);
        // Get the newly generated artist_id
        let artistId = result.insertId;

        // Insert the new record into the records table, using the newly generated artist_id
        let insertQuery = `INSERT INTO records 
                            (artist_id, album_name, release_date, genre_id, image_url, description, record_label_id, tracklist, rating) 
                            VALUES (?, ?, ?, (SELECT genre_id FROM genre WHERE genre_name = ?), ?, ?, (SELECT record_label_id FROM record_label WHERE label_name = ?), ?, ?)`;

        connection.query(insertQuery, [artistId, album_name, release_date, genre, image, desc, record_label, tracklist, rating], (err, result) => {
          if (err) throw err;
          console.log(`Album uploaded`);
          res.render('uploadrecords-success', { message: 'Album uploaded successfully!' });
        });
      });
    } else {
      // Artist already exists in the database, so use their existing artist_id
      let artistId = result[0].artist_id;

      // Insert the new record into the records table, using the existing artist_id
      let insertQuery = `INSERT INTO records 
                          (artist_id, album_name, release_date, genre_id, image_url, description, record_label_id, tracklist, rating) 
                          VALUES (?, ?, ?, (SELECT genre_id FROM genre WHERE genre_name = ?), ?, ?, (SELECT record_label_id FROM record_label WHERE label_name = ?), ?, ?)`;

      connection.query(insertQuery, [artistId, album_name, release_date, genre, image, desc, record_label, tracklist, rating], (err, result) => {
        if (err) throw err;
        console.log(`Album uploaded`);
        res.render('uploadrecords-success', { message: 'Album uploaded successfully!' });
      });
    }
  });
});


app.listen(process.env.PORT || 3000, () => { 
  console.log("Server is running at port 3000"); 
});

app.get("/login",(req, res) => { 
  res.render('login');
});

app.post("/login", (req, res) => { 
  console.log(req.body);
  let loginData = req.body;
  let username = req.body.username;
  let password = req.body.password;

  let selectQuery = `SELECT * FROM members WHERE username = '${username}'`;
  connection.query(selectQuery, (err, result) => {
    if (err) throw err;

    if (result.length === 0) {
      // no user with this username exists in the database
      res.render('login', {error: 'Invalid username or password'});
    } else {
      // check if the password matches the user's password
      if (result[0].password === password) {
        // if user is authenticated, render the dashboard view
        res.render('dashboard', {username: username});
      } else {
        // if password is incorrect
        res.render('login', {error: 'Invalid username or password'});
      }
    }
  });
});



app.get("/register",(req, res) => { 
  res.render('register');
});

app.post("/register", (req, res) => { 
  console.log(req.body);
  let regData = req.body;
  let username = req.body.username;
  let email = req.body.email;
  let password = req.body.password;

  let insertQuery = `INSERT INTO members (username, email, password) VALUES ('${username}', '${email}', '${password}')`;
  connection.query(insertQuery, (err, result) => {
    if (err) throw err;
    console.log(`Inserted registration data for user ${username}`);
  });

  res.render('register', {regData: {username: username}});
});

app.get("/search",(req, res) => { 
  res.render('search');
});

app.post("/search", (req, res) => {
  console.log(req.body);
  let searchData = req.body.search;
  let searchQuery = `SELECT * FROM records INNER JOIN artist ON records.artist_id = artist.artist_id
                      WHERE artist.artist_name = '${searchData}'`;

  connection.query(searchQuery, function (error, album, fields) {
    if (error) throw error;
    console.log(album);

    res.render("search", { sentSearch: searchData, searchResult: album });
  });
});

app.get("/allcollections",(req, res) => { 
  res.render('allcollections');
});

app.post("/member-collections", (req, res) => {
  let record = req.body;
  let userId = req.session.userId;

   // Insert the record into the records table
  connection.query(
    "INSERT INTO records (artist, album_name, release_date, genre_id, image_url, description, rating, record_label_id, tracklist) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [record.artist, record.album_name, record.release_date, record.genre, record.image, record.desc, record.rating, record.record_label, record.tracklist],
    (err, result) => {
      if (err) throw err;

      let recordId = result.insertId;

      // Associate the record with the user's collection
      connection.query(
        "INSERT INTO collections (member_id, record_id) VALUES (?, ?)",
        [userId, recordId],
        (err, result) => {
          if (err) throw err;

          res.send("Record uploaded successfully!");
        }
      );
    }
  );
});

// View a member's collection
app.get("/member-collections", (req, res) => {
  let userId = req.session.userId;

  // Retrieve the records in the user's collection
  connection.query(
    "SELECT records.album_name, artist.artist_name, records.release_date, genre.genre_name, records.image_url, records.description, records.rating, record_label.label_name, records.tracklist FROM collections INNER JOIN records ON collections.record_id = records.record_id INNER JOIN artist ON records.artist_id = artist.artist_id INNER JOIN genre ON records.genre_id = genre.genre_id INNER JOIN record_label ON records.record_label_id = record_label.record_label_id WHERE collections.member_id = ?",
    [userId],
    (err, result) => {
      if (err) throw err;

      // Render a view that displays the records in the user's collection
      res.render("member.collections", { records: result });
    }
  );
});
