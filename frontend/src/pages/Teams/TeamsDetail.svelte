<script>
    import axios from "axios";

    export let params = {};
    let team_id;
    let player_id;
    let length;
    $: {
        team_id = params.id;
        getTeam();

        getPlayers();
    }
    let posplayer;
    let team = {
        _id: "",
        name: "",
        sportart: "",
        players: [],
        pinteam: [],
    };

    let players = [];

    function getTeam() {
        console.log("http://localhost:3001/api/teams2/" + team_id);
        axios
            .get("http://localhost:3001/api/teams2/" + team_id)
            .then((response) => {
                team = response.data;
                length = event.teams.length;
            });
    }

    function getPlayers() {
        axios.get("http://localhost:3001/api/players").then((response) => {
            players = response.data;
        });
    }

    function addPlayerToTeam() {
        if (team.players.includes(player_id)) {
            alert("Already Exists");
        } else {
            team.players.push(player_id);
            length=team.players.length;
            axios
                .put("http://localhost:3001/api/teams/" + team_id, team)
                .then((response) => {
                    getTeam();
                });
        }
    }

    function deleteTeam() {
        axios.delete("http://localhost:3001/api/teams/" + team_id);

        alert("Team has been succesfully deleted");
    }

    function editTeam() {}
    let player = {};

    function getPlayer() {
        axios
            .get("http://localhost:3001/api/players/" + id)
            .then((response) => {
                player = response.data;
            });
    }

    function deletePlayer() {
        if (!team.players.includes(player_id)) {
            alert("Player not found in team");
        } else { if((posplayer=team.players.indexOf(player_id))===0){
            team.players.shift();
            team.players.push(player_id);
        }
            length = team.players.length;
            posplayer = team.players.indexOf(player_id);
            team.players.splice(posplayer, length+1);
            axios
                .put("http://localhost:3001/api/teams/" + team_id, team)
                .then((response) => {
                    getTeam();
                });
            alert("Player has been deleted from Team ");
        }
    }
</script>

<div class="mb-5">
    <a href="#/teams/"
        ><button on:click={deleteTeam} type="button" class="btn btn-danger"
            >Delete Team</button
        ></a
    >

    <a href={"#/editteam/" + team_id}
        ><button on:click={editTeam} type="button" class="btn btn-primary"
            >Edit Team</button
        ></a
    ><br />

    <h1 class="mt-3">Team: {team.name}</h1>

    <p>Sportart: {team.sportart}</p>
    <p>Players:</p>
    <ul>
        {#each team.pinteam as p}
            <li>
                <a href={"#/players/" + p._id}>{p.name} </a>
            </li>
        {/each}
    </ul>

    <h2>Update Players:</h2>
    <label for="player">Choose player:</label>

    <select class="form-select" bind:value={player_id} id="player">
        {#each players as p}
            <option value={p._id}>{p.name}</option>
        {/each}
    </select>
    <button on:click={deletePlayer} class="btn btn-warning mt-2">
        Delete Player</button
    >
    <button class="btn btn-success mt-2" on:click={addPlayerToTeam}
        >Add Player</button
    >
</div>
