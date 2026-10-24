use clap::Parser;

#[tokio::main]
async fn main() -> eyre::Result<()> {
    gmtrade_web_backend::run(gmtrade_web_backend::Args::parse()).await
}
