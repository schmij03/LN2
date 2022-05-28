<script>
    import axios from "axios";

    let player = {
        name: "",
        gender: "",
        birthdate: ""
    };


    function addPlayer() {
        axios
            .post("http://localhost:3001/api/players", player)
            .then((response) => {
                alert("Player added");
            })
            .catch((error) => {
                console.log(error);
                alert(error);
            });
    }

    function loadFile(e) {
        src = URL.createObjectURL(e.target.files[0]);
    }
</script>

<div class="mb-5">
    <h1 class="mt-3">Add a Player</h1>

    <form>
        <div class="mb-3">
            <label for="" class="form-label">Name</label>
            <input class="form-control" type="text" bind:value={player.name} />
        </div>
        <div class="mb-3">
            <label for="" class="form-label">Gender</label>
            <input
                class="form-control"
                type="text"
                bind:value={player.gender}
            />
        </div>
        <div class="mb-3">
            <label for="" class="form-label">Birthdate</label>
            <input
                class="form-control"
                type="date"
                bind:value={player.birthdate}
            />
        </div>
        <a href="#/players"
            ><button on:click={addPlayer} type="button" class="btn btn-primary">
                Add Player
            </button></a
        >
    </form>
</div>
