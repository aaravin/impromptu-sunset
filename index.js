// In case this is run in production, we won't use dotenv
// heroku handles that for us using its environment variables
if(process.env.NODE_ENV && process.env.NODE_ENV === "production"){
  console.log(process.env.DATABASE_URL);
} else {
  require('dotenv').load();
}

var app = require('./server/server.js');

var http = require('http').Server(app);

var port = process.env.PORT || 3000;

var io = require('socket.io')(http);

// server now listening to port 'port'
http.listen(port, function() {
  console.log("listening to port ", port);
});

module.exports = http;


/////////
// socket.io logic
/////////

// allSocketIDs holds list of user data looked up by their socketID
/*
  {
    socketId: { username: JackSparrow, password: CoolHat }
  }
  socketId is generated by socket.io when a new client opens a socket
*/
var allSocketIDs = {};

// stores all of the usernames as the key, and the socketId as the value
// used to prevent more than one tab / socket connection affecting the user's color index
var allUsernames = {};

var users = {};
var rooms = {}, roomIdx = 0, roomLimit = 3;
// establishes a new user's connection socket
io.on('connection', function(socket) {
  socket.on('joinGame', function() {
    users[socket.id] = {};
    users[socket.id].id = socket.id;
    socket.emit('getUser', null);

    if(!rooms[roomIdx]){
      rooms[roomIdx] = {
        users: [],
        roomSize: 0
      }
    }

    if(rooms[roomIdx].roomSize < roomLimit){
      socket.join(roomIdx);
      rooms[roomIdx].users.push([socket.id, rooms[roomIdx].roomSize]);
      rooms[roomIdx].roomSize++;
    }

    if(rooms[roomIdx].roomSize === roomLimit){
      console.log('start')
      //send start signal and opponents
      console.log(roomIdx, rooms[roomIdx].users)
      io.to(roomIdx).emit('start', rooms[roomIdx].users);
      //console.log(rooms)
      roomIdx++;
    } 

    socket.on('sendUser', function(username){
      //console.log(username)
      users[socket.id].username = username;
    });

    socket.on('post', function(data){
      //console.log('received', data)
      socket.to(socket.rooms[1]).emit('update', data);
    });
    
  });
  // when they disconnect
  socket.on('disconnect', function() {
    if (allSocketIDs[socket.id]) {
      var username = allUsernames[allSocketIDs[socket.id]];
      // send the client the user object so they know to delete it
      io.emit('userExit', allSocketIDs[socket.id]);
      delete allUsernames[allSocketIDs[socket.id].username]
      // remove the user from the server users collection
      delete allSocketIDs[socket.id];
    }
  });
 
  // when a user sends an update event
  socket.on('postUserUpdate', function(data) {
    // if there is no username (if they have not logged in)
    if (!data.username) {
      // eject
      return;
    }
    // if the user does not already exist in the active users collection
    if (!allUsernames[data.username]) {
      // add the username key, along with the socket id value
      allUsernames[data.username] = socket.id;
    }
    // if the username matches the socket id in the active users collection
    if (allUsernames[data.username] === socket.id) {
      // console.log('username matches the socket', allUsernames[data.username], data.username);  
      // add the user to the server's allSocketIDs collection
      allSocketIDs[socket.id] = data;
      // emit the update to all users
      io.emit('getUserUpdate', data);
    }
  });

  // when the client asks for the list of all users
  socket.on('getAllUsers', function() {
    // array to send to the user of all user data
    var allUsersData = [];

    // pushes all user data from sockets into allUsersData
    // we do this to hide the socketIDs from the clients
    for (var i = 0; i < allSocketIDs.length; i++) {
      allUsersData.push(allSocketIDs[i]);
    }

    // send the collection of all users to the client
    io.emit('allServerUsers', allUsersData);
  });
});

