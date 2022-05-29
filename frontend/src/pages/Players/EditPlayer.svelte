<script>
    import axios from "axios";
    export let params = {};
    let id;
    let genderss = [
        "Male",
        "Female",
        "Non-binary",
        "Transgender",
        "Bigender",
        "Genderfluid",
        "Agender",
    ];
    let player = {};

    function editPlayer() {
        axios
            .put("http://localhost:3001/api/players/" + id, player)
            .then((response) => {});
        alert("User angepasst");
    }
    $: {
        id = params.id;
        getPlayer();
    }
    function getPlayer() {
        axios
            .get("http://localhost:3001/api/players/" + id)
            .then((response) => {
                player = response.data;
            });
    }
</script>

<div class="mb-5">
    <h1 class="mt-3">Edit a Player</h1>
    <form>
        <div class="mb-3">
            <label for="Name" class="form-label"
                >Name: <input
                    class="form-control"
                    bind:value={player.name}
                /></label
            >
        </div>
        <div class="mb-3">
            <label for="" class="form-label"
                >Gender: <select
                    class="form-select"
                    bind:value={player.gender}
                    id="team"
                >
                    {#each genderss as t}
                        <option value={t}>{t}</option>
                    {/each}
                </select></label
            >
        </div>
        <div class="mb-3">
            <label for="" class="form-label">
                Current Birthdate: {player.birthdate}
            </label>
        </div>
        <div class="mb-3">
            <label class="form-label"
                >New Birthdate: <input
                    class="form-control"
                    type="date"
                /></label
            >
        </div>
    </form>

    <a href={"#/players/" + id}
        ><button type="button" class="btn btn-secondary">Cancel</button></a
    >
    <a href={"#/players/" + id}
        ><button on:click={editPlayer} type="button" class="btn btn-primary"
            >Ok</button
        ></a
    >
</div>
