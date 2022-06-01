<script>
    import axios from "axios";
   

    export let params = {};
    let team_id;
    let player_id;

    $: {
        team_id = params.id;
        getTeam();
        getPlayers();
    }

    let team = {
        _id: "",
        name: "",
        sportart: "",
        players: []
    };

    let players = [];

    function getTeam() {
        axios.get("http://localhost:3001/api/teams/" + team_id)
            .then((response) => {
                team = response.data;
            });
    }

    function getPlayers() {
        axios.get("http://localhost:3001/api/players")
            .then((response) => {
                players = response.data;
            });
    }

    function addPlayerToTeam() {
       if (team.players.includes(player_id)){
           alert("Already Exists")
       } else {
           team.players.push(player_id);
        axios.put("http://localhost:3001/api/teams/" + team_id, team)
            .then((response) => {
                getTeam();
            }); 
       }

       
    }

   // function alreadyExists(){
       // alert("User already existing in current Team");
   // }


   function deleteTeam(){
        axios.delete("http://localhost:3001/api/teams/"+team_id)
        
        alert("Team has been succesfully deleted")
    }

    function editTeam(){

    }
    let player = {};

    function getPlayer() {
        axios.get("http://localhost:3001/api/players/" + id)
            .then((response) => {
                player = response.data;
            });
    }

</script>

<div class="mb-5">
    <h1 class="mt-3">Team: {team.name}</h1>
    <p>Sportart: {team.sportart}</p>
    <p>Players:</p>
    <ul>
        {#each team.players as p}
            <li>
                <a href={"#/players/"+p}>{p} </a>
            </li>
        {/each}
    </ul>

    <h2>Update Players</h2>
    <label for="player">Add Players to team</label>
    
    <select class="form-select" bind:value={player_id} id="player">
        {#each players as p}
            
           <option value={p._id}>{p.name}</option>
           {/each}
    </select>
  
    <button class="btn btn-primary mt-2" on:click={addPlayerToTeam}>Update Team</button>
   
</div>
<a href="#/teams/"><button on:click={deleteTeam} type="button" class="btn btn-danger">Delete Team</button></a>
<a href={"#/editteam/"+team_id}><button on:click={editTeam} type="button" class="btn btn-primary">Edit Team</button></a>