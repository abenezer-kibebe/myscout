import soccerdata as sd

fbref = sd.FBref(
    leagues="ENG-Premier League",
    seasons="2024-2025"
)

df = fbref.read_player_season_stats(
    stat_type="standard"
)

print("SHAPE:", df.shape)
print("INDEX:", df.index.names)
print("COLUMNS:", df.columns.tolist())
print(df.head(3).to_string())