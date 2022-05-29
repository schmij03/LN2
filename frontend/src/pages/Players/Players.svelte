<script>
    import axios from "axios";
    
    let players = [];

    function getPlayers() {
        axios.get("http://localhost:3001/api/players").then((response) => {
            players = response.data;
        });
    }
    getPlayers();

  
</script>

<div class="mb-5">
    <h1 class="mt-3">List of all Players</h1>
    
    <a href="#/create-player"><button type="button" class="btn btn-primary">Add Player </button></a>

    <table class="table table-striped table-hover">
        <thead>
            <tr>
                
                <th>Name</th>
                <th>Gender</th>
                <th>Birthdate</th>
                <th>Player Details</th>
            </tr>
        </thead>
        <tbody>
            {#each players as player}
                <tr>
                    <td>
                        {player.name}
                        
                    </td>
                        <td>
                        {player.gender}
                        </td>
                    <td>
                        {player.birthdate}
                    </td>

                    <td>
                        <a href={"#/players/" + player._id}>
                            Details
                        </a>
                    </td>

                </tr>
            {/each}
        </tbody>
    </table>
</div>
