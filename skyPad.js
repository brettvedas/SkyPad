var myNote;

// Database access -------------------------------------------------
var SkyPadDatabase = {
    // database object
    db: null,
    
    // flag that tracks if we have opened the database for the very first time
    opened: false,
	
	shortName: "SkyPad",
	version: "1.0",
	displayName: "SkyPad Database",
	maxSize: 65536, // in bytes
	
	init: function() {
		var self = this;
		
        try {
            if (window.openDatabase) {
				self.db = openDatabase(self.shortName, self.version, self.displayName, self.maxSize);
				
				if (self.db) {
					self.opened = true;
					
					self.createNotesTable();
				} else {
					alert("Failed to open the database on disk. This is probably because the version was bad or there is not enough space left in this domain's quota.");
				}
            } else {
				alert("Couldn't open the database.  Please try with a WebKit nightly with the database feature enabled.");
			}
        } catch(ex) { 
			alert("Couldn't open the database.  Please try with a WebKit nightly with this feature enabled.");
		}
		
		if (self.opened) {
			self.findNotes(null, "id");
		}
		
		return self.opened;
    },
	
	executeSQL: function(sqlStatement, sqlArguments, callback, errorCallback) {
		var self = this;
		
		// default errorCallBack
		errorCallback = (errorCallback != null ? errorCallback : self.errorHandler);
		
		// transactionCallback
        function txCallback(tx) { tx.executeSql(sqlStatement, sqlArguments, callback, errorCallback); };
		
        self.db.transaction(txCallback);
	},
	
	// Begin SkyPad Notes data access functions -------------------------------------------------
	createNotesTable: function() {
		var self = this;
		
        var statement = "CREATE TABLE IF NOT EXISTS notes(id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, body BLOB NOT NULL DEFAULT '', created_at REAL NOT NULL, updated_at REAL);";
		
		self.executeSQL(statement, [], self.nullDataHandler);
	},
	
	dropNotesTable: function() {
		var self = this;
		
        var statement = "DROP TABLE notes;";
		
		self.executeSQL(statement, [], self.nullDataHandler);
	},
	
	findNotes: function(searchText, orderBy, descending) {
		var self = this;
		
        var statement = "SELECT * FROM notes";
		var arguments = [];
		
		if (searchText) {
			searchText = '%' + searchText + '%';
			
			statement += " WHERE notes.title LIKE ? OR notes.body LIKE ?";
			arguments = [searchText, searchText];
		}
		
		if (orderBy) {
			statement += " ORDER BY " + orderBy + (descending == true ? " DESC" : "");
		}
		
		statement += ";";
		
		self.executeSQL(statement, arguments, self.findNotesHandler);
	},
	
	findNotesHandler: function(tx, resultSet) {
		if (resultSet.rows.length > 0) {
			for (var i=0; i<resultSet.rows.length; i++) {
				var note = Note.toNote(resultSet.rows.item(i));
				
				Note.appendToList(note);
			}
		}
	},
	
	saveNote: function(note) {
		var self = this;
		
        var statement = "";
		var arguments = [];
		
		// set the timestamp to reflect the change
		note.updated_at = new Date().getTime();
		
		// check to see if this is an insert or update
		if (note.id == 0) {
			note.created_at = new Date().getTime();
			
			statement = "INSERT INTO notes (title, body, created_at, updated_at) VALUES (?, ?, ?, ?);";
			arguments = [note.title, note.body, note.created_at, note.updated_at];
		} else {
			statement = "UPDATE notes set title=?, body=?, updated_at=? where id=?;";
			arguments = [note.title, note.body, note.updated_at, note.id];
		}
		
		self.executeSQL(statement, arguments, self.saveNoteHandler);
	},
	
	saveNoteHandler: function(tx, resultSet) {
		// gets the note.id from the last insert
		if (myNote.id == 0) {
			myNote.id = resultSet.insertId;
		}
	},
	
	deleteNote: function(note) {
		var self = this;
		
        var statement = "DELETE FROM notes WHERE id = ?";
        var arguments = [note.id];

        self.executeSQL(statement, arguments, self.nullDataHandler);
    },
	
	// End SkyPad Notes data access functions -------------------------------------------------
	
	/*! When passed as the error handler, this silently causes a transaction to fail. */
	killTransaction: function(tx, error) {
		return true; // fatal transaction error
	},

	/*! When passed as the error handler, this causes a transaction to fail with a warning message. */
	errorHandler: function(tx, error) {
		// Error is a human-readable string.
		alert("Oops.  Error was " + error.message + " (Code " + error.code + ")");
	},
	
	/*! This is used as a data handler for a request that should return no data. */
	nullDataHandler: function(tx, results) {
	}
}

// Note object -------------------------------------------------------
function Note(title, body, id, created_at, updated_at) {
	this.id = (id != undefined ? id : 0);
	this.title = title;
	this.body = body;
	this.created_at = (created_at != undefined ? created_at : null);
	this.updated_at = (updated_at != undefined ? updated_at : null);
}

Note.prototype.toString = function() {
    var retVal = "";
	
	retVal += "{id:" + this.id;
	retVal += ", title:" + this.title;
	retVal += ", body:" + this.body;
	retVal += ", created_at:" + this.created_at;
	retVal += ", updated_at:" + this.updated_at;
	retVal += "}";
	
	return retVal;
}

Note.appendToList = function(note) {
    var html = '<article><a id="' + note.id + '"><h1>' + note.title + '</h1><p>';
	html += note.body.substring(0, 44);
	html += (note.body.length > 45 ? " ..." : "");
	html += '</p></a></article>';
	
	$(html).appendTo("#sbresults");
	
	$("#" + note.id).click(function () {
		Note.viewNote(note);
	});
	
	// if this item was previously being edited display it again
	if (myNote && note.id == myNote.id) {
		Note.viewNote(note);
	}
}

Note.toNote = function(data) {
    return new Note(data.title, data.body, data.id, data.created_at, data.updated_at);
}

Note.viewNote = function(note) {
	myNote = note;

    $(".selected").removeClass("selected");
    
    if (note.id > 0) {
		$("#" + note.id).parent().addClass("selected");
		
		$("#editcarea").hide();
		$("#trash").show();
		$('#edit').show();
		$("#viewcarea").show();
	} else {
		$("#viewcarea").hide();
		$("#trash").hide();
		$("#editcarea").show();
	}
	
	$("#viewtitle").text(note.title);
	$("#mcontent").text(note.body);
		
	
	$("#ctitle").val(note.title);
	$("#ccontent").val(note.body);
}

// UI Listeners -------------------------------------------------------
$(document).ready(function(){
	
	$("#sbaddnew").click(function () {
		var myNote = new Note('', '');
		
		Note.viewNote(myNote);
	});
	
	$('#search').focus(function() {
		if ($("#search").val() == "Search...") {
			$("#search").val("");
		}
	});
	
	$('.submitsearch').mousedown(function() {
		var searchtext = $("#search").val();
	
		$("#sbresults > article").remove();
		
		$("#keyword").text(searchtext);
		
		SkyPadDatabase.findNotes(searchtext, "id");
	});
	
	$('#xresults').mousedown(function() {
		$("#search").val("Search...");
		
		$("#keyword").text("");
	
		$("#sbresults > article").remove();
		
		SkyPadDatabase.findNotes(null, "id");
	});
	
	$('#save').mousedown(function() {
		if ($("#ctitle").val().length > 0 && $("#ccontent").val().length > 0) {
			myNote.title = $("#ctitle").val();
			myNote.body = $("#ccontent").val();
			
			SkyPadDatabase.saveNote(myNote);
			
			$("#sbresults > article").remove();
			
			SkyPadDatabase.findNotes(null, "id");
		} else {
			alert("Oops, you left something empty ...");
		}
	});
	
	$('#edit').mousedown(function() {
		$(".carea").toggle();
	});
	
	$('#canceledit').mousedown(function() {
		$(".carea").toggle();
		
		$("#ctitle").val(myNote.title);
		$("#ccontent").val(myNote.body);
		
		if (myNote && myNote.id == 0) {
			$('#edit').hide();
		}
	});
	
	$('#trash').mousedown(function() {
		SkyPadDatabase.deleteNote(myNote);
		
		$('#edit').hide();
		
		$("#sbresults > article").remove();
		
		SkyPadDatabase.findNotes(null, "id");
		
		myNote = new Note('', '');
		
		Note.viewNote(myNote);
		
		$(".carea").toggle();
	});
});