<script>
    import axios from "axios";

    let team = {
        name: "",
        sportart: "",
        players:[]
        
    };
    let sports=["Fussball", "Eishockey", "Pingpong", "Tennis", "Leichtathletik", "Unihockey", "Baseball", "Volleyball", "Basketball"]

    function addTeam() {
        
        axios.post("http://localhost:3001/api/teams", team)
                     .then((response) => {
                alert("Team added");
            })
            .catch((error) => {
                console.log(error);
                alert(error);
            });
            
        }


</script>

<div class="mb-5">
    <h1 class="mt-3">Add a Team</h1>

    <form>
        <div class="mb-3">
            <label for="" class="form-label">Name</label>
            <input class="form-control" type="text" bind:value={team.name} />
        </div>
        <div class="mb-3">
            <label for="" class="form-label">Sportart</label>
            <select class="form-select" bind:value={team.sportart} id="team">
                {#each sports as t}
                    <option value={t}>{t}</option>
                {/each}
            </select>
            
        </div>
        
       
       <a href="#/teams"> <button on:click={addTeam} type="button" class="btn btn-primary">
            Add Team
        </button></a>
    </form>
</div>
