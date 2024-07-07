import { Converter } from 'showdown';
import { Git } from './git';

export class FoundryWebsiteApi {

  public static async markdownToHtml(markdown: string): Promise<string> {
    // Prefix relative links
    const githubRepository = await new Git().getGithubRepoName();
    const commitHash = await new Git().getCurrentLongHash();
    if (githubRepository && commitHash) {
      markdown = markdown.replace(/(\[(.*?[^\\](?:\\\\)*)]\()\//g, `$1https://github.com/${githubRepository}/raw/${commitHash}/`)
    }
    
    const converter = new Converter({
      simplifiedAutoLink: true,
    });
    return converter.makeHtml(markdown);
  }

}