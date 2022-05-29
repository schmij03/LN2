<script>
    import axios from "axios";
    let player={}
function getPlayer() {
        axios.get("http://localhost:3001/api/players/" + id)
            .then((response) => {
                player = response.data;
            });
    }
function editPlayer(){
    getPlayer();
    team.players.push(player_id);
        axios.put("http://localhost:3001/api/players/" + player_id, team)
            .then((response) => {
                getTeam();
            });
}
</script>

<form action="">
    <label for="Name">Name: <input type="text"  bind:value={player.name} ></label>
    <label for="Name">Gender: <input type="text" bind:value={player.name} ></label>
</form>
<button on:click={editPlayer} type="button" class="btn btn-danger">Ok</button>
<style>
   
</style>
