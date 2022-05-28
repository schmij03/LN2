<script>
    import axios from "axios";

    export let params = {};

    let id;

    function deletePlayer(){
        axios.delete("http://localhost:3001/api/players/"+id)
        
        alert("Player has been succesfully deleted")
    }

    function editPlayer(){

    }

    $: {
        // "Reactive Statement":
        // This block of is executed whenever the value of a variable in it changes.
        // See https://svelte.dev/tutorial/reactive-statements
        id = params.id;
        getPlayer();
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
    <h1 class="mt-3">Player Name: {player.name}</h1>
    <p>ID: {id}</p>
    <p>Gender: {player.gender}</p>
    <p>Birthdate: {player.birthdate}</p>
    
</div>

<a href="#/players"><button on:click={deletePlayer} type="button" class="btn btn-danger">Delete Player</button></a>
<a href={"#/players"+id}><button on:click={editPlayer} type="button" class="btn btn-primary">Edit Player</button></a>
